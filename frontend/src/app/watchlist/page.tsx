"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Trash2, LogIn, Film } from "lucide-react";
import { useWatchlist } from "@/context/WatchlistContext";
import { fetchMovieDetail, fetchRecommendations } from "@/lib/api";
import { MovieResult } from "@/lib/types";

export default function WatchlistPage() {
  const { user, savedIds, toggleMovie, signInWithGoogle } = useWatchlist();
  const [movies, setMovies] = useState<MovieResult[]>([]);
  const [recs, setRecs] = useState<MovieResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (savedIds.length === 0) {
        if (active) {
          setMovies([]);
          setRecs([]);
          setLoading(false);
        }
        return;
      }
      if (active) setLoading(true);
      const [details, recommended] = await Promise.all([
        Promise.all(
          savedIds.map((id) =>
            fetchMovieDetail(String(id))
              .then((d) => d.movie)
              .catch(() => null)
          )
        ),
        savedIds.length >= 2
          ? fetchRecommendations(savedIds, 6).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (active) {
        setMovies(details.filter((m): m is MovieResult => m !== null));
        setRecs(recommended);
        setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [savedIds]);

  return (
    <div className="space-y-12">
      <section className="flex flex-col justify-between gap-4 rounded-3xl border border-[#1E2230] bg-[#0F1117] p-6 shadow-xl sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="flex items-center gap-2 text-[#EAB308]">
            <Bookmark className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {user ? "Cloud Synced Bucket List" : "Guest Bucket List"}
            </span>
          </div>
          <h1
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
            className="mt-1 text-3xl font-bold text-white"
          >
            Your Cinema Bucket List
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {user
              ? `Synced to ${user.email}. Save 2+ films to unlock personalized recommendations.`
              : "Saved in your browser. Sign in with Google to sync across devices."}
          </p>
        </div>

        {!user && (
          <button
            type="button"
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-2 self-start rounded-full bg-[#EAB308] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#FACC15] active:scale-95"
          >
            <LogIn className="h-4 w-4" />
            Sync with Google
          </button>
        )}
      </section>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading your saved films...</p>
      ) : movies.length === 0 ? (
        <div className="rounded-3xl border border-[#1E2230] bg-[#0F1117] p-12 text-center">
          <Film className="mx-auto h-8 w-8 text-[#EAB308]" />
          <h2 className="mt-3 text-lg font-semibold text-white">
            Your bucket list is empty
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Bookmark films while browsing Discover to build your bucket list and
            personalize recommendations.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-[#EAB308] px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-[#FACC15]"
          >
            Explore Movies
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {movies.map((m) => (
            <div
              key={m.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-[#1E2230] bg-[#0F1117] transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700"
            >
              <Link href={`/movie/${m.id}`}>
                {m.poster_url && (
                  <img
                    src={m.poster_url}
                    alt={m.title}
                    loading="lazy" decoding="async" className="aspect-[2/3] w-full object-cover"
                  />
                )}
              </Link>
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <Link
                    href={`/movie/${m.id}`}
                    className="font-semibold text-white hover:text-[#EAB308]"
                  >
                    {m.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {m.release_year} · {m.runtime ? `${m.runtime}m` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleMovie(m.id)}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full border border-[#1E2230] bg-[#07080B] py-2 text-xs font-medium text-zinc-300 transition hover:border-red-500/40 hover:text-red-400 active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recs.length > 0 && (
        <section className="space-y-4 border-t border-[#1E2230] pt-10">
          <div>
            <h2
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
              className="text-2xl font-bold text-white"
            >
              Recommended From Your Bucket List
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Curated automatically from the themes and tone of your{" "}
              {savedIds.length} saved films.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {recs.map((rec) => (
              <Link
                key={rec.id}
                href={`/movie/${rec.id}`}
                className="group rounded-2xl border border-[#1E2230] bg-[#0F1117] p-3 transition-all duration-300 hover:-translate-y-1 hover:border-[#EAB308]/50"
              >
                {rec.poster_url && (
                  <img
                    src={rec.poster_url}
                    alt={rec.title}
                    loading="lazy" decoding="async" className="aspect-[2/3] w-full rounded-xl object-cover"
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
