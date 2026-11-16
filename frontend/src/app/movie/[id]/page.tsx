"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Star,
  Play,
  ExternalLink,
  Bookmark,
  Check,
  ChevronDown,
} from "lucide-react";
import { fetchMovieDetail } from "@/lib/api";
import { MovieDetailResponse } from "@/lib/types";
import { useWatchlist } from "@/context/WatchlistContext";

export default function MovieDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<MovieDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTech, setShowTech] = useState(false);
  const { toggleMovie, isSaved } = useWatchlist();

  useEffect(() => {
    const movieId = params?.id;
    if (!movieId) return;
    let active = true;
    fetchMovieDetail(String(movieId))
      .then((res) => {
        if (active) setDetail(res);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Failed to load film.");
      });
    return () => {
      active = false;
    };
  }, [params?.id]);

  if (error) {
    return (
      <div className="space-y-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Discover
        </Link>
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-5 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!detail) {
    return <p className="py-12 text-sm text-zinc-400">Loading film...</p>;
  }

  const { movie, neighbors } = detail;
  const bookmarked = isSaved(movie.id);
  const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${movie.title} ${movie.release_year || ""} official trailer`
  )}`;
  const googleWatchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `where to watch ${movie.title} ${movie.release_year || ""} movie`
  )}`;

  return (
    <div className="space-y-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Discover
      </Link>

      <section className="overflow-hidden rounded-3xl border border-[#1E2230] bg-[#0F1117]">
        {movie.backdrop_url && (
          <div className="relative h-60 w-full sm:h-80">
            <img
              src={movie.backdrop_url}
              alt={movie.title}
              className="h-full w-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F1117] via-[#0F1117]/60 to-transparent" />
          </div>
        )}

        <div className="relative -mt-20 flex flex-col gap-8 p-6 sm:flex-row sm:p-10">
          {movie.poster_url && (
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="h-64 w-44 shrink-0 rounded-2xl border border-[#1E2230] object-cover shadow-2xl"
            />
          )}

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              {movie.release_year && <span>{movie.release_year}</span>}
              {movie.runtime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {movie.runtime} min
                </span>
              )}
              {movie.rating && (
                <span className="flex items-center gap-1 font-semibold text-zinc-200">
                  <Star className="h-3.5 w-3.5 fill-[#EAB308] text-[#EAB308]" />
                  {movie.rating} / 10
                </span>
              )}
            </div>

            <h1
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
              className="text-3xl font-bold text-white sm:text-4xl"
            >
              {movie.title}
            </h1>

            <div className="flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-[#1E2230] bg-[#07080B] px-3 py-1 text-xs text-zinc-300"
                >
                  {g}
                </span>
              ))}
            </div>

            <p className="max-w-3xl text-sm leading-relaxed text-zinc-300">
              {movie.overview}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={ytUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#EAB308] px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-[#FACC15]"
              >
                <Play className="h-3.5 w-3.5 fill-black" />
                Watch Trailer on YouTube
              </a>

              <a
                href={googleWatchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#1E2230] bg-[#07080B] px-5 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600"
              >
                Where to Stream
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <button
                type="button"
                onClick={() => void toggleMovie(movie.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-semibold transition ${
                  bookmarked
                    ? "border-[#EAB308] bg-[#EAB308]/15 text-[#EAB308]"
                    : "border-[#1E2230] bg-[#07080B] text-zinc-200 hover:border-zinc-600"
                }`}
              >
                {bookmarked ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    In Bucket List
                  </>
                ) : (
                  <>
                    <Bookmark className="h-3.5 w-3.5" />
                    Add to Bucket List
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-3 text-xs text-zinc-400 sm:grid-cols-2">
              <div>
                <span className="font-semibold text-zinc-200">Director: </span>
                {movie.director || "N/A"}
              </div>
              <div>
                <span className="font-semibold text-zinc-200">Starring: </span>
                {movie.cast_names.join(", ") || "N/A"}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowTech(!showTech)}
                className="inline-flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-300"
              >
                <span>Under the hood: Catalog &amp; embedding metadata</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${
                    showTech ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showTech && (
                <div className="mt-2 rounded-xl border border-[#1E2230] bg-[#07080B] p-3 font-mono text-xs text-zinc-400">
                  TMDB Catalog ID: {movie.id} · Indexed with 768-d semantic
                  embeddings + field-weighted full-text search.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
            className="text-2xl font-bold text-white"
          >
            Similar Movies You Might Love
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Films that share the closest storytelling, tone, and thematic DNA.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {neighbors.map((n) => {
            const simPct = Math.round(n.signals.dense_score * 100);
            return (
              <Link
                key={n.id}
                href={`/movie/${n.id}`}
                className="group rounded-2xl border border-[#1E2230] bg-[#0F1117] p-3.5 transition hover:border-zinc-700"
              >
                {n.poster_url && (
                  <img
                    src={n.poster_url}
                    alt={n.title}
                    className="aspect-[2/3] w-full rounded-xl object-cover"
                  />
                )}
                <h3 className="mt-3 line-clamp-1 text-sm font-semibold text-white group-hover:text-[#EAB308]">
                  {n.title}
                </h3>
                <p className="text-xs text-zinc-500">{n.release_year}</p>

                <div className="mt-2.5">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Story Similarity</span>
                    <span className="font-semibold text-[#EAB308]">
                      {simPct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-[#EAB308]"
                      style={{ width: `${Math.min(100, simPct)}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
