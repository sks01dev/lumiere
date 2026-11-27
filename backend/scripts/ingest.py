# backend/scripts/ingest.py
import asyncio
import csv
import io
import os
import re
import time
import zipfile
import httpx
import numpy as np
import psycopg
from dotenv import load_dotenv
from google import genai
from google.genai import errors, types

load_dotenv()

DB_URL = os.environ["SUPABASE_DB_URL"]
TMDB_KEY = os.environ["TMDB_API_KEY"]
GEMINI_KEY = os.environ["GEMINI_API_KEY"]

gemini = genai.Client(api_key=GEMINI_KEY)

MOVIELENS_URL = "https://files.grouplens.org/datasets/movielens/ml-latest-small.zip"
TARGET_MOVIES = 3000
EMBED_BATCH_SIZE = 45         # Strictly below Gemini's 100 items/min free-tier limit
BATCH_SLEEP_SECONDS = 32.0    # ~84 items/min steady throughput
TMDB_CONCURRENCY = 25


def l2_normalize(vector: list[float]) -> list[float]:
    """Scales truncated 768-d Matryoshka vectors to unit length for exact cosine similarity."""
    arr = np.array(vector, dtype=np.float32)
    norm = float(np.linalg.norm(arr))
    return (arr / norm).tolist() if norm > 0.0 else arr.tolist()


def get_existing_ids() -> set[int]:
    """Fetches already-ingested movie IDs from Supabase so runs are 100% resumable."""
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM movies WHERE embedding IS NOT NULL;")
            return {row[0] for row in cur.fetchall()}


async def fetch_movielens_tmdb_ids(limit: int = 7500) -> list[int]:
    """Downloads MovieLens links.csv in memory (~1 MB) and extracts valid TMDB IDs."""
    async with httpx.AsyncClient(timeout=60.0) as http:
        resp = await http.get(MOVIELENS_URL)
        resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            with zf.open("ml-latest-small/links.csv") as raw:
                reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8"))
                return [
                    int(row["tmdbId"])
                    for row in reader
                    if row.get("tmdbId") and row["tmdbId"].isdigit()
                ][:limit]


async def fetch_tmdb_movie(
    http: httpx.AsyncClient, tmdb_id: int, sem: asyncio.Semaphore
) -> dict | None:
    """Fetches enriched movie metadata, director, top cast, and thematic keywords from TMDB."""
    async with sem:
        url = f"https://api.themoviedb.org/3/movie/{tmdb_id}"
        params = {"api_key": TMDB_KEY, "append_to_response": "credits,keywords"}
        try:
            resp = await http.get(url, params=params)
            if resp.status_code != 200:
                return None

            data = resp.json()
            if (
                not data.get("overview")
                or not data.get("poster_path")
                or (data.get("vote_count") or 0) < 50
            ):
                return None

            release_date = data.get("release_date") or ""
            year = int(release_date[:4]) if len(release_date) >= 4 and release_date[:4].isdigit() else None
            genres = [g["name"] for g in data.get("genres", [])]
            crew = data.get("credits", {}).get("crew", [])
            director = next((c["name"] for c in crew if c.get("job") == "Director"), "")
            cast_names = [c["name"] for c in data.get("credits", {}).get("cast", [])[:5]]
            keywords = [k["name"] for k in data.get("keywords", {}).get("keywords", [])[:12]]

            search_doc = (
                f"Title: {data['title']} ({year or 'N/A'})\n"
                f"Genres: {', '.join(genres)}\n"
                f"Director: {director}\n"
                f"Cast: {', '.join(cast_names)}\n"
                f"Themes & Keywords: {', '.join(keywords)}\n"
                f"Plot: {data['overview']}"
            )

            return {
                "id": data["id"],
                "title": data["title"],
                "release_year": year,
                "runtime": data.get("runtime") or None,
                "rating": round(float(data.get("vote_average") or 0.0), 1),
                "poster_path": data["poster_path"],
                "backdrop_path": data.get("backdrop_path"),
                "overview": data["overview"],
                "genres": genres,
                "director": director,
                "cast_names": cast_names,
                "keywords": keywords,
                "search_doc": search_doc,
                "vote_count": data.get("vote_count", 0),
            }
        except Exception:
            return None


def embed_documents_with_retry(docs: list[str], max_retries: int = 4) -> list[list[float]]:
    """Generates L2-normalized 768-d embeddings with automatic 429 RPM backoff."""
    for attempt in range(max_retries):
        try:
            response = gemini.models.embed_content(
                model="gemini-embedding-001",
                contents=docs,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=768,
                ),
            )
            return [l2_normalize(emb.values) for emb in response.embeddings]
        except errors.ClientError as e:
            err_msg = str(e)
            if e.code == 429:
                if "PerDay" in err_msg:
                    raise RuntimeError(
                        "Daily Gemini embedding quota (1,000/day) reached. "
                        "All prior batches are safely saved in Supabase—re-run tomorrow or with a second key to resume."
                    ) from e
                if attempt < max_retries - 1:
                    match = re.search(r"retry in (\d+(?:\.\d+)?)s", err_msg)
                    wait_s = float(match.group(1)) + 2.0 if match else 35.0
                    print(f"      [RPM Limit] Sleeping {wait_s:.1f}s before retry...")
                    time.sleep(wait_s)
                    continue
            raise
    raise RuntimeError("Exceeded max retries for Gemini embeddings.")


async def run_ingestion() -> None:
    start = time.perf_counter()
    existing_ids = get_existing_ids()
    print(f"[0/3] Found {len(existing_ids)} movies already in Supabase.")

    if len(existing_ids) >= TARGET_MOVIES:
        print(f"Target ({TARGET_MOVIES}) already reached in Supabase!")
        return

    print("[1/3] Fetching MovieLens -> TMDB candidate IDs...")
    candidate_ids = await fetch_movielens_tmdb_ids(limit=7500)
    pending_ids = [mid for mid in candidate_ids if mid not in existing_ids]

    print(f"[2/3] Enriching metadata from TMDB for {len(pending_ids)} remaining candidates...")
    sem = asyncio.Semaphore(TMDB_CONCURRENCY)
    async with httpx.AsyncClient(timeout=20.0) as http:
        raw_results = await asyncio.gather(
            *(fetch_tmdb_movie(http, mid, sem) for mid in pending_ids)
        )

    needed = TARGET_MOVIES - len(existing_ids)
    movies = sorted(
        (m for m in raw_results if m is not None),
        key=lambda x: x["vote_count"],
        reverse=True,
    )[:needed]

    total_batches = (len(movies) + EMBED_BATCH_SIZE - 1) // EMBED_BATCH_SIZE
    est_mins = (total_batches * BATCH_SLEEP_SECONDS) / 60.0
    print(f"      Ingesting {len(movies)} movies across {total_batches} paced batches (~{est_mins:.1f} mins)...")

    upsert_sql = """
        INSERT INTO movies (
          id, title, release_year, runtime, rating,
          poster_path, backdrop_path, overview, genres,
          director, cast_names, keywords, search_doc, embedding
        ) VALUES (
          %(id)s, %(title)s, %(release_year)s, %(runtime)s, %(rating)s,
          %(poster_path)s, %(backdrop_path)s, %(overview)s, %(genres)s,
          %(director)s, %(cast_names)s, %(keywords)s, %(search_doc)s, %(embedding)s
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          release_year = EXCLUDED.release_year,
          runtime = EXCLUDED.runtime,
          rating = EXCLUDED.rating,
          poster_path = EXCLUDED.poster_path,
          backdrop_path = EXCLUDED.backdrop_path,
          overview = EXCLUDED.overview,
          genres = EXCLUDED.genres,
          director = EXCLUDED.director,
          cast_names = EXCLUDED.cast_names,
          keywords = EXCLUDED.keywords,
          search_doc = EXCLUDED.search_doc,
          embedding = EXCLUDED.embedding;
    """

    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            for b_idx, idx in enumerate(range(0, len(movies), EMBED_BATCH_SIZE), start=1):
                batch_start = time.perf_counter()
                batch = movies[idx : idx + EMBED_BATCH_SIZE]
                vectors = embed_documents_with_retry([m["search_doc"] for m in batch])

                for movie, vec in zip(batch, vectors):
                    cur.execute(upsert_sql, {**movie, "embedding": str(vec)})

                conn.commit()
                done = len(existing_ids) + min(idx + EMBED_BATCH_SIZE, len(movies))
                print(f"      Batch {b_idx}/{total_batches} committed -> {done}/{TARGET_MOVIES} movies in DB")

                if b_idx < total_batches:
                    elapsed_batch = time.perf_counter() - batch_start
                    sleep_for = max(0.0, BATCH_SLEEP_SECONDS - elapsed_batch)
                    if sleep_for > 0:
                        time.sleep(sleep_for)

    elapsed = time.perf_counter() - start
    print(f"Done! Database now holds {TARGET_MOVIES} movies ({elapsed:.1f}s).")


if __name__ == "__main__":
    asyncio.run(run_ingestion())