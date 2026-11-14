from typing import Literal
from pydantic import BaseModel, Field


class ExtractedFilters(BaseModel):
    year_min: int | None = None
    year_max: int | None = None
    max_runtime: int | None = None
    min_rating: float | None = None


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=300)
    mode: Literal["hybrid_rerank", "keyword_only"] = "hybrid_rerank"
    override_filters: ExtractedFilters | None = None


class SignalBreakdown(BaseModel):
    dense_score: float
    dense_rank: int | None = None
    sparse_score: float
    sparse_rank: int | None = None
    rrf_score: float
    rrf_rank: int
    rerank_score: float | None = None
    final_rank: int


class MovieResult(BaseModel):
    id: int
    title: str
    release_year: int | None
    runtime: int | None
    rating: float | None
    poster_url: str | None
    backdrop_url: str | None
    overview: str
    genres: list[str]
    director: str
    cast_names: list[str]
    match_percent: int
    signals: SignalBreakdown


class LatencyMetrics(BaseModel):
    router_ms: int
    embed_ms: int
    db_ms: int
    rerank_ms: int
    total_ms: int
    cached: bool = False


class SearchResponse(BaseModel):
    query: str
    semantic_query: str
    mode: str
    filters: ExtractedFilters
    latency: LatencyMetrics
    results: list[MovieResult]


class ExplainMovieInput(BaseModel):
    id: int
    title: str
    overview: str


class ExplainRequest(BaseModel):
    query: str
    movies: list[ExplainMovieInput] = Field(..., max_length=5)


class ExplainItem(BaseModel):
    id: int
    reason: str


class ExplainResponse(BaseModel):
    explanations: list[ExplainItem]


class MovieDetailResponse(BaseModel):
    movie: MovieResult
    neighbors: list[MovieResult]