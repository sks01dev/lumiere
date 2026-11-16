<div align="center">

# 🎬 Lumière
### Constraint-Aware Hybrid Information Retrieval & Cinema Discovery Engine

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_+_pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase_Auth_&_RLS-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)

**Semantic search that understands plot nuance, emotional tone, and hard constraints simultaneously.**

</div>

---

## Overview

Most movie catalogs force users into rigid genre dropdowns or brittle keyword matching. **Lumière** bridges natural-language intent and deterministic database filtering—allowing users to search the way they actually describe movies:

> *"mind-bending sci-fi from around the 1990s, under 2 hours 15 minutes, not sad"*

Behind a single search bar, Lumière decomposes compound temporal and runtime constraints, executes a single-hop **Reciprocal Rank Fusion (RRF)** query across dense `pgvector` HNSW embeddings and field-weighted `tsvector` indexes, re-scores candidates with a **cross-encoder**, and generates **taste-centroid recommendations** from each user's cloud-synced Bucket List.

---

## System Architecture

```text
User Query ("mind-bending sci-fi before 2000, under 2 hours 15 minutes, not sad")
   │
   ▼
[1] Hybrid Constraint & Intent Router (Deterministic Regex + Groq Llama-3.1-8B)
   ├── Hard SQL Predicates:  year_max = 1999, max_runtime = 135
   └── Clean Semantic Query: "mind-bending sci-fi, not sad"
   │
   ▼
[2] Single-Hop PostgreSQL Hybrid Retrieval (pgvector HNSW + tsvector GIN)
   ├── Dense Branch:  768-d L2-normalized Gemini embeddings (iterative_scan)
   ├── Sparse Branch: Field-weighted full-text search (title, director, cast, plot)
   └── Fusion:        Reciprocal Rank Fusion (RRF, k = 60)
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

## Multi-Layer Caching & Latency Architecture

To eliminate redundant LLM/embedding API calls, protect free-tier quotas, and keep UI navigation instantaneous, Lumière implements a **4-tier caching pipeline**:

| Layer | Module | Cache Key | Engineering Impact |
| :--- | :--- | :--- | :--- |
| **Client Detail & Centroid Cache** | `frontend/src/lib/api.ts` | `movie_id` & sorted `savedIds` | `0ms` instant navigation across Bucket List items and film detail pages with zero duplicate fetches |
| **Trailing Recommendation Debounce** | `frontend/src/app/page.tsx` | `350ms` window on `savedIds` | Coalesces rapid bookmark toggles into a single centroid recommendation request |
| **Router & Embedding Cache** | `query_router.py` & `embeddings.py` | Normalized query string | Bypasses Groq constraint extraction and Gemini embedding calls entirely on repeat queries |
| **Full Search Response Cache** | `backend/app/main.py` | `(normalized_query, mode)` | Serves repeat searches directly from FastAPI memory in `<1ms` without hitting PostgreSQL or Voyage AI |

---

## Offline Retrieval Benchmarks

Evaluated across a curated benchmark suite covering entity lookups, thematic mood queries, compound decade/runtime filters, and negation constraints:

| Retrieval Pipeline | Hit@3 | MRR@10 | nDCG@10 | Role in System |
| :--- | :---: | :---: | :---: | :--- |
| Sparse Lexical (`tsvector`) | 21.4% | 0.250 | 0.264 | Exact title, director, and cast lookup; fails on abstract mood queries |
| Dense Vector (`pgvector` HNSW) | 85.7% | 0.818 | 0.847 | High thematic recall; weaker on proper nouns and explicit negations |
| **Hybrid RRF ($k=60$)** | **100.0%** | **0.881** | **0.912** | **Single-query SQL fusion achieving 100% top-3 candidate recall** |
| **Hybrid RRF + Cross-Encoder Rerank** | **92.9%** | **0.869** | **0.896** | **Fine-grained semantic discrimination and negation resolution (*"not bleak"*)** |

---

## Key Engineering Highlights

* **Zero-Rate-Limit Compound Constraint Parsing:** Compound durations (`"under 2 hours 15 minutes"` $\rightarrow$ `135` min) and relative year expressions (`"before 2000"` $\rightarrow$ `year_max=1999`, `"around the 1990s"` $\rightarrow$ `1988–2001`) are parsed deterministically in `<0.1ms` and merged with Groq structured JSON extraction, ensuring full resilience against external LLM rate limits.
* **Post-Filtering Recall Preservation (`iterative_scan`):** Enables `pgvector` HNSW `iterative_scan` alongside hard SQL predicate guards so strict year and runtime filters never suffer from top-$k$ graph starvation.
* **Single-Hop Database Execution:** Executes dense cosine similarity, field-weighted `ts_rank_cd`, and Reciprocal Rank Fusion inside one parameterized PostgreSQL query to minimize network round-trips.
* **Resumable, Quota-Safe ETL Pipeline:** Idempotent ingestion (`backend/scripts/ingest.py`) combining MovieLens `links.csv` with TMDB enrichment and L2-normalized 768-d Matryoshka Gemini embeddings, pacing batches safely within daily free-tier limits.
* **Frictionless Guest Mode + Cloud OAuth Sync:** Supports immediate guest exploration (`localStorage`) and Google OAuth sign-in (`Supabase Auth` + PostgreSQL Row Level Security), automatically migrating local Bucket List selections to the cloud and computing a real-time taste centroid (`AVG(embedding)::vector(768)`).

---

## Repository Structure

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

## Local Setup

### 1. Backend (FastAPI)
```bash
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### 2. Data Ingestion (Resumable)
```bash
uv run python backend/scripts/ingest.py
```

### 3. Frontend (Next.js)
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

* Web App: `http://localhost:3000`
* Interactive API Docs: `http://localhost:8000/docs`

---

## API Endpoints

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health check |
| `POST` | `/api/search` | Hybrid RRF + cross-encoder search or lexical baseline with extracted metadata filters |
| `GET` | `/api/movies/{movie_id}` | Film metadata and top-5 nearest semantic neighbors in HNSW embedding space |
| `POST` | `/api/recommendations` | L2-averaged embedding centroid across saved Bucket List IDs to recommend unseen films |
| `GET` | `/api/benchmarks` | Offline retrieval ablation metrics and qualitative case studies |

---

## Production Deployment

1. **Backend (Render):** Deploy `backend/` as a Web Service (`pip install -r requirements.txt` / `uvicorn app.main:app --host 0.0.0.0 --port $PORT`) with `SUPABASE_DB_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, and `VOYAGE_API_KEY` configured.
2. **Frontend (Vercel):** Deploy `frontend/` with `NEXT_PUBLIC_API_URL` pointing to the live Render service URL along with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **OAuth Redirects (Supabase):** Add the live Vercel domain to **Authentication → URL Configuration → Site URL** and **Redirect URLs**.

---

## Data Attribution

Film metadata and artwork provided by [TMDB](https://www.themoviedb.org/) and the [GroupLens MovieLens](https://grouplens.org/datasets/movielens/) dataset.
