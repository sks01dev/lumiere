-- supabase/schema.sql

-- 1. Enable pgvector for 768-d cosine similarity search
CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS movies CASCADE;

-- 2. Main Catalog Table
CREATE TABLE movies (
  id INT PRIMARY KEY,                -- TMDB Movie ID
  title TEXT NOT NULL,
  release_year INT,
  runtime INT,                       -- Minutes
  rating FLOAT,                      -- TMDB vote_average (0.0 - 10.0)
  poster_path TEXT,
  backdrop_path TEXT,
  overview TEXT,
  genres TEXT[],
  director TEXT,
  cast_names TEXT[],
  keywords TEXT[],
  search_doc TEXT NOT NULL,          -- Structured document embedded by Gemini
  embedding VECTOR(768),             -- L2-normalized 768-d dense vector
  fts TSVECTOR                       -- Weighted full-text search vector
);

-- 3. Trigger: Auto-populate weighted tsvector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION movies_fts_trigger() RETURNS TRIGGER AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(
      to_tsvector(
        'english',
        coalesce(NEW.director, '') || ' ' ||
        coalesce(array_to_string(NEW.keywords || NEW.cast_names, ' '), '')
      ),
      'B'
    ) ||
    setweight(to_tsvector('english', coalesce(NEW.overview, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvector_update
BEFORE INSERT OR UPDATE ON movies
FOR EACH ROW EXECUTE FUNCTION movies_fts_trigger();

-- 4. Indexes: HNSW (Dense), GIN (Sparse), Composite B-Tree (SQL Filters)
CREATE INDEX movies_embedding_idx
  ON movies USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX movies_fts_idx
  ON movies USING gin (fts);

CREATE INDEX movies_filters_idx
  ON movies (release_year, runtime, rating);

-- 5. Single-Hop Filtered Hybrid RRF RPC
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  year_min INT DEFAULT NULL,
  year_max INT DEFAULT NULL,
  max_runtime INT DEFAULT NULL,
  min_rating FLOAT DEFAULT NULL,
  match_count INT DEFAULT 20,
  rrf_k INT DEFAULT 60
)
RETURNS TABLE (
  id INT,
  title TEXT,
  release_year INT,
  runtime INT,
  rating FLOAT,
  poster_path TEXT,
  backdrop_path TEXT,
  overview TEXT,
  genres TEXT[],
  director TEXT,
  cast_names TEXT[],
  search_doc TEXT,
  dense_score FLOAT,
  dense_rank INT,
  sparse_score FLOAT,
  sparse_rank INT,
  rrf_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevents HNSW recall collapse when SQL WHERE filters are active
  PERFORM set_config('hnsw.iterative_scan', 'strict_order', true);

  RETURN QUERY
  WITH dense AS (
    SELECT
      m.id,
      (1.0 - (m.embedding <=> query_embedding))::FLOAT AS d_score,
      ROW_NUMBER() OVER (ORDER BY m.embedding <=> query_embedding)::INT AS d_rank
    FROM movies m
    WHERE (year_min IS NULL OR m.release_year >= year_min)
      AND (year_max IS NULL OR m.release_year <= year_max)
      AND (max_runtime IS NULL OR m.runtime <= max_runtime)
      AND (min_rating IS NULL OR m.rating >= min_rating)
    ORDER BY m.embedding <=> query_embedding
    LIMIT 50
  ),
  sparse AS (
    SELECT
      m.id,
      ts_rank_cd(m.fts, websearch_to_tsquery('english', query_text))::FLOAT AS s_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(m.fts, websearch_to_tsquery('english', query_text)) DESC)::INT AS s_rank
    FROM movies m
    WHERE m.fts @@ websearch_to_tsquery('english', query_text)
      AND (year_min IS NULL OR m.release_year >= year_min)
      AND (year_max IS NULL OR m.release_year <= year_max)
      AND (max_runtime IS NULL OR m.runtime <= max_runtime)
      AND (min_rating IS NULL OR m.rating >= min_rating)
    ORDER BY ts_rank_cd(m.fts, websearch_to_tsquery('english', query_text)) DESC
    LIMIT 50
  ),
  fused AS (
    SELECT
      coalesce(d.id, s.id) AS movie_id,
      coalesce(d.d_score, 0.0)::FLOAT AS dense_score,
      d.d_rank AS dense_rank,
      coalesce(s.s_score, 0.0)::FLOAT AS sparse_score,
      s.s_rank AS sparse_rank,
      (coalesce(1.0 / (rrf_k + d.d_rank), 0.0) + coalesce(1.0 / (rrf_k + s.s_rank), 0.0))::FLOAT AS rrf_score
    FROM dense d
    FULL OUTER JOIN sparse s ON d.id = s.id
    ORDER BY rrf_score DESC
    LIMIT match_count
  )
  SELECT
    m.id, m.title, m.release_year, m.runtime, m.rating,
    m.poster_path, m.backdrop_path, m.overview, m.genres,
    m.director, m.cast_names, m.search_doc,
    f.dense_score, f.dense_rank, f.sparse_score, f.sparse_rank, f.rrf_score
  FROM fused f
  JOIN movies m ON m.id = f.movie_id
  ORDER BY f.rrf_score DESC;
END;
$$;