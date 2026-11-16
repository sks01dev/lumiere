import {
  BenchmarkResponse,
  MovieDetailResponse,
  MovieResult,
  SearchResponse,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

export async function searchMovies(
  query: string,
  mode: "hybrid_rerank" | "keyword_only",
): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, mode }),
  });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json();
}

export async function fetchExplanations(
  query: string,
  movies: { id: number; title: string; overview: string }[],
): Promise<Record<number, string>> {
  const res = await fetch(`${API_BASE}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, movies }),
  });
  if (!res.ok) return {};
  const data: { explanations: { id: number; reason: string }[] } =
    await res.json();
  const map: Record<number, string> = {};
  for (const item of data.explanations) {
    map[item.id] = item.reason;
  }
  return map;
}

const _MOVIE_CACHE = new Map<string, MovieDetailResponse>();
const _REC_CACHE = new Map<string, MovieResult[]>();

export async function fetchMovieDetail(
  id: string,
): Promise<MovieDetailResponse> {
  const res = await fetch(`${API_BASE}/api/movies/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Movie not found");
  return res.json();
}

export async function fetchBenchmarks(): Promise<BenchmarkResponse> {
  const res = await fetch(`${API_BASE}/api/benchmarks`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load benchmarks");
  return res.json();
}

export async function fetchRecommendations(
  movieIds: number[],
  limit = 6,
): Promise<MovieResult[]> {
  if (movieIds.length === 0) return [];
  const res = await fetch(`${API_BASE}/api/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ movie_ids: movieIds, limit }),
  });
  if (!res.ok) return [];
  const data: { recommendations: MovieResult[] } = await res.json();
  return data.recommendations;
}
