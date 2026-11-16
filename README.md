# Lumière — Constraint-Aware Hybrid Movie Search & Discovery Engine

**Lumière** is an end-to-end, multi-stage information retrieval and cinema discovery platform built to understand how people naturally describe films—combining **story themes, emotional tone, compound temporal/runtime constraints, and explicit exclusions** (e.g., _"mind-bending sci-fi from around the 1990s, under 2 hours 15 minutes, not sad"_).

Unlike keyword-only catalogs or rigid genre dropdowns, Lumière separates deterministic metadata constraints from semantic intent, retrieves candidates in a single PostgreSQL round-trip via **Reciprocal Rank Fusion (RRF)** over `pgvector` HNSW and weighted `tsvector` indexes, re-scores top results with a **cross-encoder**, and personalizes discovery using a **taste-centroid vector** computed from each user's saved Bucket List.

---

## System Architecture

```text
User Query ("sci-fi before 2000, under 2 hours 15 minutes, not sad")
   │
   ▼
[1] Hybrid Intent & Constraint Router (Deterministic Regex + Groq Llama-3.1-8B)
   ├── Hard Metadata Filters: year_max=1999, max_runtime=135
   └── Clean Semantic Query:  "mind-bending sci-fi, not sad"
   │
   ▼
[2] Single-Hop PostgreSQL Hybrid Retrieval (pgvector HNSW + tsvector GIN)
   ├── Dense Branch:  768-d L2-normalized Gemini embeddings (iterative_scan)
   ├── Sparse Branch: Field-weighted full-text search (title, director, cast, plot)
   └── Fusion:        Reciprocal Rank Fusion (RRF, k=60)
   │
   ▼
[3] Cross-Encoder Reranking (Voyage AI rerank-2.5-lite)
   └── Jointly attends over query + candidate metadata to resolve negations ("not sad")
   │
   ▼
[4] Cloud Bucket List & Vector Centroid Personalization (Supabase Auth + RLS)
   └── Computes AVG(embedding)::vector(768) across saved films to surface unseen matches
```

---

## Offline Retrieval Benchmarks

Evaluated across a curated benchmark suite spanning entity lookups, thematic mood queries, compound decade/runtime filters, and negation constraints:

| Retrieval Stage                       |   Hit@3    |  MRR@10   |  nDCG@10  | Architectural Role                                                             |
| :------------------------------------ | :--------: | :-------: | :-------: | :----------------------------------------------------------------------------- |
| Sparse Lexical (`tsvector`)           |   21.4%    |   0.250   |   0.264   | Exact title, director, and cast matching; fails on abstract mood queries       |
| Dense Vector (`pgvector` HNSW)        |   85.7%    |   0.818   |   0.847   | High thematic recall; weaker on proper nouns and explicit negations            |
| **Hybrid RRF ($k=60$)**               | **100.0%** | **0.881** | **0.912** | **Single-query SQL fusion achieving 100% top-3 candidate recall**              |
| **Hybrid RRF + Cross-Encoder Rerank** | **92.9%**  | **0.869** | **0.896** | **Fine-grained semantic discrimination and negation resolution ("not bleak")** |

---

## Key Engineering Highlights

- **Zero-Rate-Limit Deterministic + LLM Query Routing:** Compound duration phrases (`"under 2 hours 15 minutes"` $\rightarrow$ `135` min) and relative temporal expressions (`"before 2000"` $\rightarrow$ `year_max=1999`, `"around the 1990s"` $\rightarrow$ `1988–2001`) are parsed deterministically in `<0.1ms` and merged with Groq structured JSON extraction, eliminating single-point LLM rate-limit failures.
- **Post-Filtering Recall Preservation (`iterative_scan`):** Uses `pgvector` HNSW `iterative_scan` alongside hard SQL predicate guards so strict year and runtime filters never suffer from top-$k$ graph starvation.
- **Single-Hop Database Execution:** Executes dense cosine similarity, field-weighted `ts_rank_cd`, and Reciprocal Rank Fusion inside a single parameterized PostgreSQL query to minimize network round-trips.
- **Resumable, Quota-Aware Ingestion Pipeline:** Idempotent ETL pipeline (`backend/scripts/ingest.py`) combining MovieLens `links.csv` with TMDB metadata enrichment and L2-normalized 768-d Matryoshka Gemini embeddings, pacing batches safely within free-tier quotas.
- **Guest Mode + Cloud OAuth Bucket List Sync:** Supports instant guest browsing (`localStorage`) and seamless Google OAuth sign-in (`Supabase Auth` + PostgreSQL Row Level Security), automatically migrating local selections to the cloud and computing a real-time taste centroid (`AVG(embedding)::vector(768)`) once 2+ films are saved.

---

## Tech Stack

| Layer                       | Technologies                                                                                                |
| :-------------------------- | :---------------------------------------------------------------------------------------------------------- |
| **Frontend**                | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, `@supabase/supabase-js`          |
| **Backend API**             | FastAPI, Python 3.12, `psycopg3` Async Connection Pool, Pydantic v2                                         |
| **Database & Vector Store** | PostgreSQL + `pgvector` (HNSW Index) + `tsvector` (GIN Index) on Supabase                                   |
| **AI & Retrieval Models**   | Google Gemini Embeddings (`768-d` Matryoshka), Groq (`llama-3.1-8b-instant`), Voyage AI (`rerank-2.5-lite`) |
| **Infrastructure**          | Docker on Render (Backend API), Vercel (Frontend), Supabase Auth & RLS                                      |

---

## Project Structure

```text
lumiere/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── schemas.py
│   │   └── services/
│   │       ├── query_router.py
│   │       ├── embeddings.py
│   │       ├── retrieval.py
│   │       ├── reranker.py
│   │       └── explainer.py
│   ├── eval/
│   │   ├── run_eval.py
│   │   └── results.json
│   ├── scripts/
│   │   └── ingest.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx
│       │   ├── watchlist/page.tsx
│       │   ├── movie/[id]/page.tsx
│       │   ├── benchmarks/page.tsx
│       │   └── about/page.tsx
│       ├── components/
│       │   ├── Navbar.tsx
│       │   └── Footer.tsx
│       ├── context/
│       │   └── WatchlistContext.tsx
│       └── lib/
│           ├── api.ts
│           ├── supabase.ts
│           └── types.ts
└── README.md
```

---

## Local Development Setup

### Prerequisites

- Python 3.12+ (`uv` recommended) and Node.js 20+
- Supabase PostgreSQL instance with `pgvector` enabled
- API keys for TMDB, Google AI Studio (Gemini), Groq, and Voyage AI

### 1. Backend

```bash
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### 2. Data Ingestion

```bash
uv run python backend/scripts/ingest.py
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

---

## API Reference

| Method | Endpoint                 | Description                                                                                    |
| :----- | :----------------------- | :--------------------------------------------------------------------------------------------- |
| `GET`  | `/health`                | Service health check                                                                           |
| `POST` | `/api/search`            | Executes hybrid RRF + cross-encoder search or lexical baseline with extracted filters          |
| `GET`  | `/api/movies/{movie_id}` | Returns film metadata and top-5 nearest semantic neighbors in HNSW space                       |
| `POST` | `/api/recommendations`   | Computes the L2-averaged embedding centroid of saved Bucket List IDs to recommend unseen films |
| `GET`  | `/api/benchmarks`        | Serves offline retrieval ablation metrics and failure-mode case studies                        |

---

## Production Deployment

1. **Backend (Render):** Deploy `backend/` as a Docker Web Service (`PORT=8000`) with `SUPABASE_DB_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, and `VOYAGE_API_KEY` configured.
2. **Frontend (Vercel):** Deploy `frontend/` with `NEXT_PUBLIC_API_URL` pointing to the Render service URL along with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **OAuth Redirects (Supabase):** Add the live Vercel domain to **Authentication → URL Configuration → Site URL** and **Redirect URLs**.
