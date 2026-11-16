export interface ExtractedFilters {
  year_min: number | null;
  year_max: number | null;
  max_runtime: number | null;
  min_rating: number | null;
}

export interface SignalBreakdown {
  dense_score: number;
  dense_rank: number | null;
  sparse_score: number;
  sparse_rank: number | null;
  rrf_score: number;
  rrf_rank: number;
  rerank_score: number | null;
  final_rank: number;
}

export interface MovieResult {
  id: number;
  title: string;
  release_year: number | null;
  runtime: number | null;
  rating: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string;
  genres: string[];
  director: string;
  cast_names: string[];
  match_percent: number;
  signals: SignalBreakdown;
}

export interface LatencyMetrics {
  router_ms: number;
  embed_ms: number;
  db_ms: number;
  rerank_ms: number;
  total_ms: number;
  cached: boolean;
}

export interface SearchResponse {
  query: string;
  semantic_query: string;
  mode: "hybrid_rerank" | "keyword_only";
  filters: ExtractedFilters;
  latency: LatencyMetrics;
  results: MovieResult[];
}

export interface MovieDetailResponse {
  movie: MovieResult;
  neighbors: MovieResult[];
}

export interface AblationRow {
  stage: string;
  hit_at_3: number;
  mrr_at_10: number;
  ndcg_at_10: number;
  p95_latency_ms: number;
}

export interface BenchmarkResponse {
  corpus_size: number;
  num_queries: number;
  ablation_table: AblationRow[];
  case_studies: {
    query: string;
    sparse_issue: string;
    hybrid_rerank_win: string;
  }[];
}
