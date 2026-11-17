"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Film,
  Clock,
  Star,
  SlidersHorizontal,
  Bookmark,
  Check,
  LogIn,
  ArrowRight,
  Compass,
  Heart,
} from "lucide-react";
import { fetchRecommendations, searchMovies } from "@/lib/api";
import { MovieResult, SearchResponse } from "@/lib/types";
import { useWatchlist } from "@/context/WatchlistContext";

const PRESET_QUERIES = [
  "mind-bending sci-fi from around the 1990s, under 2 hours, not sad",
  "space survival movie that is uplifting and hopeful, not bleak",
  "obsessive musician pushed to the limit by a strict mentor",
  "Christopher Nolan twist thriller about rival magicians",
];

export default function DiscoverPage() {
  const {
    user,
    isGuest,
    ready,
    savedIds,
    enterAsGuest,
    toggleMovie,
    isSaved,
    signInWithGoogle,
  } = useWatchlist();

  const [query, setQuery] = useState(PRESET_QUERIES[0]);
  const [mode, setMode] = useState<"hybrid_rerank" | "keyword_only">(
    "hybrid_rerank"
  );
  const [data, setData] = useState<SearchResponse | null>(null);
  const [forYou, setForYou] = useState<MovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEntered = Boolean(user || isGuest);

  const runSearch = useCallback(
    async (
      targetQuery: string,
      targetMode: "hybrid_rerank" | "keyword_only"
    ) => {
      if (!targetQuery.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const resp = await searchMovies(targetQuery, targetMode);
        setData(resp);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to reach Lumière API. Check backend status."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!hasEntered) return;
    const timer = setTimeout(() => {
      void runSearch(PRESET_QUERIES[0], "hybrid_rerank");
    }, 0);
    return () => clearTimeout(timer);
  }, [hasEntered, runSearch]);

  useEffect(() => {
    if (!hasEntered) return;
    let active = true;
    const timer = setTimeout(async () => {
      if (savedIds.length >= 2) {
        const recs = await fetchRecommendations(savedIds, 6);
        if (active) setForYou(recs);
      } else if (active) {
        setForYou([]);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [hasEntered, savedIds]);

  function handleModeSwitch(nextMode: "hybrid_rerank" | "keyword_only") {
    setMode(nextMode);
    void runSearch(query, nextMode);
  }

  if (!ready) {
    return null;
  }

  if (!hasEntered) {
    return (
      <div className="mx-auto w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <div className="rounded-3xl border border-[#1E2230] bg-[#0F1117] p-8 text-center sm:p-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#EAB308]/30 bg-[#EAB308]/10 px-4 py-1 text-xs font-semibold tracking-wide text-[#EAB308]">
            <Film className="h-3.5 w-3.5" />
            Curated Cinema Discovery
          </span>

          <h1
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
            className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl"
          >
            Discover films by mood, story, and nuance.
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
            Lumière understands how you actually describe movies—combining
            plot themes, era and runtime constraints, and exclusions like{" "}
            <span className="italic text-zinc-200">
              &ldquo;mind-bending 90s sci-fi under 2 hours, not sad&rdquo;
            </span>
            .
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={signInWithGoogle}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#EAB308] px-7 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-[#FACC15] active:scale-95 sm:w-auto"
            >
              <LogIn className="h-4 w-4" />
              Sign in with Google
            </button>

            <button
              type="button"
              onClick={enterAsGuest}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#1E2230] bg-[#07080B] px-7 py-3.5 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white active:scale-95 sm:w-auto"
            >
              Browse as Guest
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 border-t border-[#1E2230] pt-8 text-left sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#1E2230] bg-[#07080B] p-5">
              <Compass className="h-5 w-5 text-[#EAB308]" />
              <h2 className="mt-3 text-sm font-semibold text-white">
                Natural-Language Search
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Describe plots, vibes, decades, or runtime limits in plain
                English.
              </p>
            </div>

            <div className="rounded-2xl border border-[#1E2230] bg-[#07080B] p-5">
              <Bookmark className="h-5 w-5 text-[#EAB308]" />
              <h2 className="mt-3 text-sm font-semibold text-white">
                Cloud Bucket List
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Save your cinema bucket list across devices when signed in with
                Google.
              </p>
            </div>

            <div className="rounded-2xl border border-[#1E2230] bg-[#07080B] p-5">
              <Heart className="h-5 w-5 text-[#EAB308]" />
              <h2 className="mt-3 text-sm font-semibold text-white">
                Taste-Matched Picks
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Save 2+ films to unlock personalized recommendations tailored to
                your taste.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-[#1E2230] bg-[#0F1117] p-6 sm:p-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
              className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
            >
              Find the exact film you’re in the mood for.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Search naturally by story, atmosphere, decade, runtime limits, or
              what to avoid.
            </p>
          </div>

          <div className="inline-flex self-start rounded-full border border-[#1E2230] bg-[#07080B] p-1">
            <button
              type="button"
              onClick={() => handleModeSwitch("hybrid_rerank")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === "hybrid_rerank"
                  ? "bg-[#EAB308] text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              Semantic Search
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch("keyword_only")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === "keyword_only"
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Exact Keyword Match
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(query, mode);
          }}
          className="mt-6 flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-3.5 left-4 h-5 w-5 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe a mood, plot, era, runtime limit, or what to exclude..."
              className="w-full rounded-full border border-[#1E2230] bg-[#07080B] py-3.5 pr-5 pl-12 text-sm text-white placeholder-zinc-500 transition-colors focus:border-[#EAB308] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[#EAB308] px-7 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-[#FACC15] active:scale-95 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Try:</span>
          {PRESET_QUERIES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setQuery(preset);
                void runSearch(preset, mode);
              }}
              className="rounded-full border border-[#1E2230] bg-[#07080B] px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-[#EAB308]/50 hover:text-white"
            >
              {preset}
            </button>
          ))}
        </div>
      </section>

      {data && (
        <section className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 font-medium text-zinc-400">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#EAB308]" />
              Active Filters:
            </span>
            {data.filters.year_min || data.filters.year_max ? (
              <span className="rounded-full bg-[#EAB308]/15 px-3 py-0.5 font-medium text-[#FDE047]">
                {data.filters.year_min && data.filters.year_max
                  ? `${data.filters.year_min}–${data.filters.year_max}`
                  : data.filters.year_max
                  ? `Before ${data.filters.year_max + 1}`
                  : `From ${data.filters.year_min}`}
              </span>
            ) : null}
            {data.filters.max_runtime ? (
              <span className="rounded-full bg-[#EAB308]/15 px-3 py-0.5 font-medium text-[#FDE047]">
                Under {data.filters.max_runtime} min
              </span>
            ) : null}
            {data.filters.min_rating ? (
              <span className="rounded-full bg-[#EAB308]/15 px-3 py-0.5 font-medium text-[#FDE047]">
                Rated {data.filters.min_rating}+
              </span>
            ) : null}
            {!data.filters.year_min &&
              !data.filters.year_max &&
              !data.filters.max_runtime &&
              !data.filters.min_rating && (
                <span className="text-zinc-500">All eras &amp; runtimes</span>
              )}
          </div>

          <span className="text-zinc-400">
            Showing {data.results.length} films in{" "}
            <strong className="font-medium text-zinc-200">
              {(data.latency.total_ms / 1000).toFixed(2)}s
            </strong>
          </span>
        </section>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Instant Shimmer Skeleton Loader during search */}
      {loading && !data && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse overflow-hidden rounded-2xl border border-[#1E2230] bg-[#0F1117]"
            >
              <div className="aspect-[16/10] w-full bg-zinc-900" />
              <div className="space-y-3 p-5">
                <div className="h-5 w-2/3 rounded bg-zinc-800" />
                <div className="h-3 w-1/2 rounded bg-zinc-800/80" />
                <div className="h-12 w-full rounded bg-zinc-800/50" />
              </div>
            </div>
          ))}
        </div>
      )}

      {data && !loading && data.results.length === 0 && (
        <div className="rounded-3xl border border-[#1E2230] bg-[#0F1117] p-12 text-center">
          <p className="text-base font-medium text-zinc-200">
            No exact keyword matches found.
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Switch to{" "}
            <button
              type="button"
              onClick={() => handleModeSwitch("hybrid_rerank")}
              className="font-semibold text-[#EAB308] underline"
            >
              Semantic Search
            </button>{" "}
            to search by meaning, atmosphere, and exclusions.
          </p>
        </div>
      )}

      {data && (
        <div
          className={`grid grid-cols-1 gap-6 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${
            loading ? "opacity-60" : "opacity-100"
          }`}
        >
          {data.results.map((movie) => {
            const bookmarked = isSaved(movie.id);
            return (
              <div
                key={movie.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#1E2230] bg-[#0F1117] transition-transform duration-200 hover:-translate-y-1 hover:border-zinc-700"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    void toggleMovie(movie.id);
                  }}
                  title={
                    bookmarked
                      ? "Remove from Bucket List"
                      : "Add to Bucket List"
                  }
                  className={`absolute top-3 right-16 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 transition-colors active:scale-90 ${
                    bookmarked
                      ? "bg-[#EAB308] text-black"
                      : "bg-[#07080B]/90 text-zinc-200 hover:bg-white hover:text-black"
                  }`}
                >
                  {bookmarked ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                </button>

                <Link href={`/movie/${movie.id}`} className="flex flex-1 flex-col">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-900">
                    {movie.backdrop_url || movie.poster_url ? (
                      <img
                        src={movie.backdrop_url || movie.poster_url || ""}
                        alt={movie.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F1117] via-[#0F1117]/20 to-transparent" />

                    <span className="absolute top-3 left-3 rounded-full border border-white/10 bg-[#07080B]/90 px-3 py-1 text-xs font-semibold text-[#EAB308]">
                      {movie.match_percent}% Match
                    </span>

                    <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full border border-white/10 bg-[#07080B]/90 px-2.5 py-1 text-xs font-medium text-zinc-200">
                      <Star className="h-3.5 w-3.5 fill-[#EAB308] text-[#EAB308]" />
                      {movie.rating ?? "N/A"}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <h2 className="text-lg font-semibold text-white transition-colors group-hover:text-[#EAB308]">
                        {movie.title}
                      </h2>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span>{movie.release_year}</span>
                        {movie.runtime && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {movie.runtime}m
                            </span>
                          </>
                        )}
                        {movie.director && (
                          <>
                            <span>•</span>
                            <span>{movie.director}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {movie.genres.slice(0, 3).map((g) => (
                          <span
                            key={g}
                            className="rounded-full border border-[#1E2230] bg-[#07080B] px-2.5 py-0.5 text-[11px] text-zinc-300"
                          >
                            {g}
                          </span>
                        ))}
                      </div>

                      <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-zinc-400">
                        {movie.overview}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {forYou.length > 0 && (
        <section className="space-y-4 border-t border-[#1E2230] pt-10">
          <div>
            <h2
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
              className="text-2xl font-bold text-white"
            >
              Recommended From Your Bucket List
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Curated automatically from the themes and tone of the{" "}
              {savedIds.length} films you saved.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:grid-cols-6">
            {forYou.map((rec) => (
              <Link
                key={rec.id}
                href={`/movie/${rec.id}`}
                className="group rounded-2xl border border-[#1E2230] bg-[#0F1117] p-3 transition-transform duration-200 hover:-translate-y-1 hover:border-[#EAB308]/50"
              >
                {rec.poster_url && (
                  <img
                    src={rec.poster_url}
                    alt={rec.title}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[2/3] w-full rounded-xl object-cover"
                  />
                )}
                <h3 className="mt-2.5 line-clamp-1 text-sm font-semibold text-white group-hover:text-[#EAB308]">
                  {rec.title}
                </h3>
                <p className="text-xs text-zinc-500">
                  {rec.release_year} · {rec.match_percent}% Affinity
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
