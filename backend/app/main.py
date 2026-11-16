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
    RecommendRequest,
    RecommendResponse,
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
    get_watchlist_recommendations,
    search_hybrid_db,
    search_keyword_only_db,
)

_SEARCH_CACHE: dict[tuple[str, str, int], SearchResponse] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_pool()
    yield
    await close_db_pool()


app = FastAPI(
    title="Lumière Hybrid IR API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _format_movie(row: dict, rrf_rank: int, final_rank: int) -> MovieResult:
    dense_score = float(row.get("dense_score") or 0.0)
    rerank_score = row.get("rerank_score")
    raw_conf = (
        float(rerank_score)
        if rerank_score is not None
        else min(1.0, dense_score * 1.25)
    )
    match_pct = max(55, min(99, int(round(60 + raw_conf * 38))))

    poster = row.get("poster_path")
    backdrop = row.get("backdrop_path")

    return MovieResult(
        id=row["id"],
        title=row["title"],
        release_year=row.get("release_year"),
        runtime=row.get("runtime"),
        rating=float(row["rating"]) if row.get("rating") is not None else None,
        poster_url=f"https://image.tmdb.org/t/p/w500{poster}" if poster else None,
        backdrop_url=f"https://image.tmdb.org/t/p/w1280{backdrop}" if backdrop else None,
        overview=row.get("overview") or "",
        genres=row.get("genres") or [],
        director=row.get("director") or "",
        cast_names=row.get("cast_names") or [],
        match_percent=match_pct,
        signals=SignalBreakdown(
            dense_score=round(dense_score, 4),
            dense_rank=row.get("dense_rank"),
            sparse_score=round(float(row.get("sparse_score") or 0.0), 4),
            sparse_rank=row.get("sparse_rank"),
            rrf_score=round(float(row.get("rrf_score") or 0.0), 5),
            rrf_rank=rrf_rank,
            rerank_score=round(float(rerank_score), 4)
            if rerank_score is not None
            else None,
            final_rank=final_rank,
        ),
    )


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "lumiere-hybrid-ir"}


@app.post("/api/search", response_model=SearchResponse)
async def search_movies(req: SearchRequest):
    cache_key = (req.query.strip().lower(), req.mode, req.limit)
    if cache_key in _SEARCH_CACHE:
        cached_resp = _SEARCH_CACHE[cache_key].model_copy(deep=True)
        cached_resp.latency.cached = True
        cached_resp.latency.total_ms = 4
        return cached_resp

    t_start = time.perf_counter()

    # 1. LLM Structured Query Routing
    t0 = time.perf_counter()
    semantic_query, filters = await route_query(req.query)
    router_ms = int((time.perf_counter() - t0) * 1000)

    if req.mode == "keyword_only":
        t_db = time.perf_counter()
        rows = await search_keyword_only_db(semantic_query, filters, limit=req.limit)
        db_ms = int((time.perf_counter() - t_db) * 1000)
        results = [
            _format_movie(r, rrf_rank=idx + 1, final_rank=idx + 1)
            for idx, r in enumerate(rows)
        ]
        total_ms = int((time.perf_counter() - t_start) * 1000)
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
                total_ms=total_ms,
            ),
            results=results,
        )
        _SEARCH_CACHE[cache_key] = resp
        return resp

    # 2. Query Embedding (768-d L2-normalized)
    t_emb = time.perf_counter()
    query_vec = list(embed_query_cached(semantic_query))
    embed_ms = int((time.perf_counter() - t_emb) * 1000)

    # 3. Single-Hop Hybrid Dense + Sparse RRF Retrieval
    t_db = time.perf_counter()
    candidates = await search_hybrid_db(
        semantic_query, query_vec, filters, match_count=20
    )
    db_ms = int((time.perf_counter() - t_db) * 1000)

    for idx, c in enumerate(candidates):
        c["_rrf_rank"] = idx + 1

    # 4. Cross-Encoder Reranking
    t_rerank = time.perf_counter()
    reranked = rerank_candidates(semantic_query, candidates, top_k=req.limit)
    rerank_ms = int((time.perf_counter() - t_rerank) * 1000)

    results = [
        _format_movie(r, rrf_rank=r["_rrf_rank"], final_rank=idx + 1)
        for idx, r in enumerate(reranked)
    ]
    total_ms = int((time.perf_counter() - t_start) * 1000)

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
            total_ms=total_ms,
        ),
        results=results,
    )
    _SEARCH_CACHE[cache_key] = resp
    return resp


@app.post("/api/explain", response_model=ExplainResponse)
async def explain_results(req: ExplainRequest):
    explanations = await generate_explanations(req.query, req.movies)
    return ExplainResponse(explanations=explanations)


@app.get("/api/movies/{movie_id}", response_model=MovieDetailResponse)
async def movie_detail(movie_id: int):
    movie_row, neighbor_rows = await get_movie_with_neighbors(movie_id, limit=5)
    if not movie_row:
        raise HTTPException(status_code=404, detail="Movie not found")

    movie = _format_movie({**movie_row, "dense_score": 1.0}, rrf_rank=1, final_rank=1)
    neighbors = [
        _format_movie(
            {**n, "dense_score": n["dense_score"]}, rrf_rank=idx + 1, final_rank=idx + 1
        )
        for idx, n in enumerate(neighbor_rows)
    ]
    return MovieDetailResponse(movie=movie, neighbors=neighbors)


@app.post("/api/recommendations", response_model=RecommendResponse)
async def recommend_for_watchlist(req: RecommendRequest):
    rows = await get_watchlist_recommendations(req.movie_ids, limit=req.limit)
    items = [
        _format_movie(
            {**r, "dense_score": r["dense_score"]}, rrf_rank=idx + 1, final_rank=idx + 1
        )
        for idx, r in enumerate(rows)
    ]
    return RecommendResponse(recommendations=items)


@app.get("/api/benchmarks")
async def get_benchmarks():
    results_path = Path(__file__).resolve().parents[1] / "eval" / "results.json"
    if not results_path.exists():
        raise HTTPException(
            status_code=404, detail="Run backend/eval/run_eval.py first."
        )
    return json.loads(results_path.read_text(encoding="utf-8"))