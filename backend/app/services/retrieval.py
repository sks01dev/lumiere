from app.db import get_pool
from app.schemas import ExtractedFilters



def _apply_hard_filters(rows: list[dict], filters) -> list[dict]:
    out = []
    for r in rows:
        yr = r.get("release_year")
        rt = r.get("runtime")
        rat = r.get("rating")
        if filters.year_min is not None and (yr is None or yr < filters.year_min):
            continue
        if filters.year_max is not None and (yr is None or yr > filters.year_max):
            continue
        if filters.max_runtime is not None and (rt is None or rt > filters.max_runtime):
            continue
        if filters.min_rating is not None and (rat is None or float(rat) < filters.min_rating):
            continue
        out.append(r)
    return out

async def search_hybrid_db(
    query_text: str,
    query_embedding: list[float],
    filters: ExtractedFilters,
    match_count: int = 20,
) -> list[dict]:
    """Calls single-hop Supabase hybrid_search RPC (HNSW iterative_scan + weighted FTS RRF)."""
    pool = get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT * FROM hybrid_search(
                  %(query_text)s,
                  %(query_embedding)s::vector(768),
                  %(year_min)s,
                  %(year_max)s,
                  %(max_runtime)s,
                  %(min_rating)s,
                  %(match_count)s,
                  60
                );
                """,
                {
                    "query_text": query_text,
                    "query_embedding": str(query_embedding),
                    "year_min": filters.year_min,
                    "year_max": filters.year_max,
                    "max_runtime": filters.max_runtime,
                    "min_rating": filters.min_rating,
                    "match_count": match_count,
                },
            )
            rows = await cur.fetchall()
            return _apply_hard_filters(rows, filters)


async def search_keyword_only_db(
    query_text: str,
    filters: ExtractedFilters,
    limit: int = 12,
) -> list[dict]:
    """Baseline lexical-only retrieval for the Discover navbar toggle comparison."""
    pool = get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT
                  id, title, release_year, runtime, rating,
                  poster_path, backdrop_path, overview, genres,
                  director, cast_names, search_doc,
                  0.0::float AS dense_score,
                  NULL::int AS dense_rank,
                  ts_rank_cd(fts, websearch_to_tsquery('english', %(q)s::text))::float AS sparse_score,
                  ROW_NUMBER() OVER (ORDER BY ts_rank_cd(fts, websearch_to_tsquery('english', %(q)s::text)) DESC)::int AS sparse_rank,
                  0.0::float AS rrf_score
                FROM movies
                WHERE fts @@ websearch_to_tsquery('english', %(q)s::text)
                  AND (%(year_min)s::int IS NULL OR release_year >= %(year_min)s::int)
                  AND (%(year_max)s::int IS NULL OR release_year <= %(year_max)s::int)
                  AND (%(max_runtime)s::int IS NULL OR runtime <= %(max_runtime)s::int)
                  AND (%(min_rating)s::float IS NULL OR rating >= %(min_rating)s::float)
                ORDER BY sparse_score DESC
                LIMIT %(limit)s::int;
                """,
                {
                    "q": query_text,
                    "year_min": filters.year_min,
                    "year_max": filters.year_max,
                    "max_runtime": filters.max_runtime,
                    "min_rating": filters.min_rating,
                    "limit": limit,
                },
            )
            rows = await cur.fetchall()
            return _apply_hard_filters(rows, filters)


async def get_movie_with_neighbors(movie_id: int, limit: int = 5) -> tuple[dict | None, list[dict]]:
    """Fetches a single movie and its nearest semantic neighbors in pgvector HNSW space."""
    pool = get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT
                  id, title, release_year, runtime, rating,
                  poster_path, backdrop_path, overview, genres,
                  director, cast_names, embedding::text AS emb_text
                FROM movies
                WHERE id = %(mid)s::int;
                """,
                {"mid": movie_id},
            )
            movie = await cur.fetchone()
            if not movie:
                return None, []

            emb_text = movie.pop("emb_text", None)
            if not emb_text:
                return movie, []

            await cur.execute(
                """
                SELECT
                  id, title, release_year, runtime, rating,
                  poster_path, backdrop_path, overview, genres,
                  director, cast_names,
                  (1.0 - (embedding <=> %(emb)s::vector(768)))::float AS dense_score
                FROM movies
                WHERE id <> %(mid)s::int
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> %(emb)s::vector(768)
                LIMIT %(limit)s::int;
                """,
                {"mid": movie_id, "emb": emb_text, "limit": limit},
            )
            neighbors = await cur.fetchall()
            return movie, neighbors


async def get_watchlist_recommendations(movie_ids: list[int], limit: int = 6) -> list[dict]:
    """Computes the centroid embedding of saved watchlist movies in PostgreSQL and finds unseen neighbors."""
    if not movie_ids:
        return []
    pool = get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                WITH centroid AS (
                  SELECT AVG(embedding) AS avg_emb
                  FROM movies
                  WHERE id = ANY(%(ids)s::int[])
                    AND embedding IS NOT NULL
                )
                SELECT
                  m.id, m.title, m.release_year, m.runtime, m.rating,
                  m.poster_path, m.backdrop_path, m.overview, m.genres,
                  m.director, m.cast_names,
                  (1.0 - (m.embedding <=> c.avg_emb))::float AS dense_score
                FROM movies m
                CROSS JOIN centroid c
                WHERE c.avg_emb IS NOT NULL
                  AND m.embedding IS NOT NULL
                  AND NOT (m.id = ANY(%(ids)s::int[]))
                ORDER BY m.embedding <=> c.avg_emb
                LIMIT %(limit)s::int;
                """,
                {"ids": movie_ids, "limit": limit},
            )
            return await cur.fetchall()
