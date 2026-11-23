import Link from "next/link";

const API_DOCS_URL = `${
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000"
}/docs`;

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-[#1E2230] bg-[#07080B]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <span
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
              className="text-xl font-bold text-white"
            >
              Lumière
            </span>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
              Thoughtful movie discovery built for how people actually think—by
              mood, story, era, runtime, and nuance.
            </p>
            <p className="mt-4 text-xs text-zinc-500">
              Film metadata &amp; artwork courtesy of TMDB and MovieLens.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Explore
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
              <li>
                <Link href="/" className="transition hover:text-white">
                  Discover Movies
                </Link>
              </li>
              <li>
                <Link href="/watchlist" className="transition hover:text-white">
                  My Bucket List
                </Link>
              </li>
              <li>
                <Link href="/benchmarks" className="transition hover:text-white">
                  Search Benchmarks
                </Link>
              </li>
              <li>
                <Link href="/about" className="transition hover:text-white">
                  About &amp; Architecture
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Developers
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
              <li>
                <a
                  href="https://github.com/sks01dev/lumiere"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  GitHub Source Code
                </a>
              </li>
              <li>
                <a
                  href={API_DOCS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  OpenAPI Documentation
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#1E2230] pt-6 text-xs text-zinc-500 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Lumière Cinema Search.</p>
          
        </div>
      </div>
    </footer>
  );
}
