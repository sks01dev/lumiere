import json
import time
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.db import close_db_pool, init_db_pool
from app.schemas import (
    ExplainRequest,
    ExplainResponse,
    LatencyMetrics,
    MovieDetailResponse,
    MovieResult,
    SearchRequest,
    SearchResponse,
    SignalBreakdown,
)
from app.services.embeddings import embed_query_cached
from app.services.explainer import generate_explanations
from app.services.query_router import route_query
from app.services.reranker import rerank_candidates
from app.services.retrieval import (
    get_movie_with_neighbors,
    search_hybrid_db,
    search_keyword_only_db,
)

TMDB_IMG_BASE = "https://image.tmdb.org/t/p"
_SEARCH_CACHE: dict[str, SearchResponse] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_pool()
    yield
    await close_db_pool()


app = FastAPI(title="Lumière Hybrid Search API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _format_movie(row: dict, rrf_rank: int, final_rank: int) -> MovieResult:
    rerank_score = row.get("rerank_score")
    if rerank_score is not None:
        match_pct = min(99, max(62, int(round(65 + rerank_score * 34))))
    else:
        match_pct = min(95, max(55, int(round(row.get("dense_score", 0.5) * 100))))

    return MovieResult(
        id=row["id"],
        title=row["title"],
        release_year=row.get("release_year"),
        runtime=row.get("runtime"),
        rating=row.get("rating"),
        poster_url=f"{TMDB_IMG_BASE}/w500{row['poster_path']}" if row.get("poster_path") else None,
        backdrop_url=f"{TMDB_IMG_BASE}/w1280{row['backdrop_path']}" if row.get("backdrop_path") else None,
        overview=row.get("overview") or "",
        genres=row.get("genres") or [],
        director=row.get("director") or "",
        cast_names=row.get("cast_names") or [],
        match_percent=match_pct,
        signals=SignalBreakdown(
            dense_score=round(float(row.get("dense_score") or 0.0), 4),
            dense_rank=row.get("dense_rank"),
            sparse_score=round(float(row.get("sparse_score") or 0.0), 4),
            sparse_rank=row.get("sparse_rank"),
            rrf_score=round(float(row.get("rrf_score") or 0.0), 5),
            rrf_rank=rrf_rank,
            rerank_score=rerank_score,
            final_rank=final_rank,
        ),
    )


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "lumiere-api"}


@app.post("/api/search", response_model=SearchResponse)
async def search_movies(req: SearchRequest):
    t_start = time.perf_counter()
    cache_key = f"{req.mode}:{req.query.strip().lower()}:{req.override_filters}"
    if cache_key in _SEARCH_CACHE:
        cached_resp = _SEARCH_CACHE[cache_key].model_copy(deep=True)
        cached_resp.latency.total_ms = max(1, int((time.perf_counter() - t_start) * 1000))
        cached_resp.latency.cached = True
        return cached_resp

    t0 = time.perf_counter()
    if req.override_filters is not None:
        semantic_query, filters = req.query.strip(), req.override_filters
    else:
        semantic_query, filters = await route_query(req.query)
    router_ms = int((time.perf_counter() - t0) * 1000)

    if req.mode == "keyword_only":
        t_db = time.perf_counter()
        rows = await search_keyword_only_db(semantic_query, filters, limit=12)
        db_ms = int((time.perf_counter() - t_db) * 1000)
        results = [_format_movie(r, idx + 1, idx + 1) for idx, r in enumerate(rows)]
        resp = SearchResponse(
            query=req.query,
            semantic_query=semantic_query,
            mode=req.mode,
            filters=filters,
            latency=LatencyMetrics(
                router_ms=router_ms,
                embed_ms=0,
                db_ms=db_ms,
                rerank_ms=0,
                total_ms=int((time.perf_counter() - t_start) * 1000),
            ),
            results=results,
        )
        _SEARCH_CACHE[cache_key] = resp
        return resp

    t_emb = time.perf_counter()
    q_vec = list(embed_query_cached(semantic_query))
    embed_ms = int((time.perf_counter() - t_emb) * 1000)

    t_db = time.perf_counter()
    rrf_candidates = await search_hybrid_db(semantic_query, q_vec, filters, match_count=20)
    db_ms = int((time.perf_counter() - t_db) * 1000)

    rrf_rank_map = {row["id"]: idx + 1 for idx, row in enumerate(rrf_candidates)}

    t_rr = time.perf_counter()
    reranked_rows = rerank_candidates(semantic_query, rrf_candidates, top_k=12)
    rerank_ms = int((time.perf_counter() - t_rr) * 1000)

    results = [
        _format_movie(r, rrf_rank=rrf_rank_map.get(r["id"], idx + 1), final_rank=idx + 1)
        for idx, r in enumerate(reranked_rows)
    ]

    resp = SearchResponse(
        query=req.query,
        semantic_query=semantic_query,
        mode=req.mode,
        filters=filters,
        latency=LatencyMetrics(
            router_ms=router_ms,
            embed_ms=embed_ms,
            db_ms=db_ms,
            rerank_ms=rerank_ms,
            total_ms=int((time.perf_counter() - t_start) * 1000),
        ),
        results=results,
    )
    _SEARCH_CACHE[cache_key] = resp
    return resp


@app.post("/api/explain", response_model=ExplainResponse)
async def explain_matches(req: ExplainRequest):
    explanations = await generate_explanations(req.query, req.movies)
    return ExplainResponse(explanations=explanations)


@app.get("/api/movies/{movie_id}", response_model=MovieDetailResponse)
async def movie_detail(movie_id: int):
    movie, raw_neighbors = await get_movie_with_neighbors(movie_id)
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    main_item = _format_movie(movie, rrf_rank=1, final_rank=1)
    neighbors = [
        _format_movie({**n, "dense_score": n["similarity"]}, rrf_rank=idx + 1, final_rank=idx + 1)
        for idx, n in enumerate(raw_neighbors)
    ]
    return MovieDetailResponse(movie=main_item, neighbors=neighbors)


@app.get("/api/benchmarks")
async def get_benchmarks():
    results_path = Path(__file__).resolve().parents[1] / "eval" / "results.json"
    if not results_path.exists():
        return {"status": "pending", "message": "Run eval/run_eval.py to generate results.json"}
    return json.loads(results_path.read_text(encoding="utf-8"))