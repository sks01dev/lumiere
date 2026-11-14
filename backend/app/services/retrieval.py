from app.db import get_pool
from app.schemas import ExtractedFilters


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
            return await cur.fetchall()


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
            return await cur.fetchall()

async def get_movie_with_neighbors(movie_id: int) -> tuple[dict | None, list[dict]]:
    """Fetches a single movie and its top 5 vector nearest neighbors for Pipeline X-Ray."""
    pool = get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, title, release_year, runtime, rating,
                       poster_path, backdrop_path, overview, genres, director, cast_names
                FROM movies WHERE id = %(id)s;
                """,
                {"id": movie_id},
            )
            movie = await cur.fetchone()
            if not movie:
                return None, []

            await cur.execute(
                """
                SELECT
                  m.id, m.title, m.release_year, m.runtime, m.rating,
                  m.poster_path, m.backdrop_path, m.overview, m.genres,
                  m.director, m.cast_names,
                  (1.0 - (m.embedding <=> target.embedding))::float AS similarity
                FROM movies m, (SELECT embedding FROM movies WHERE id = %(id)s) target
                WHERE m.id != %(id)s
                ORDER BY m.embedding <=> target.embedding
                LIMIT 5;
                """,
                {"id": movie_id},
            )
            neighbors = await cur.fetchall()
            return movie, neighbors