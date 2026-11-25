import { ExternalLink, GitBranch } from "lucide-react";

const API_DOCS_URL = `${
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000"
}/docs`;

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-[#1E2230] bg-[#0F1117] p-6 sm:p-10">
        <h1
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          className="text-3xl font-bold text-white sm:text-4xl"
        >
          About Lumière
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">
          Most movie apps force you to remember an exact title or click through
          rigid genre dropdowns. Lumière was built to let you search the way
          people actually describe movies to a friend—combining story meaning,
          decade &amp; runtime constraints, and exclusions like{" "}
          <span className="italic text-[#FDE047]">&ldquo;not sad&rdquo;</span>.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 w-full min-w-0">
          <a
            href="https://github.com/sks01dev/lumiere"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#EAB308] px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-[#FACC15] w-full min-w-0"
          >
            <GitBranch className="h-4 w-4" />
            View Source Code on GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={API_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[#1E2230] bg-[#07080B] px-5 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 w-full min-w-0"
          >
            Interactive API Docs
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 w-full min-w-0">
        <div className="rounded-2xl border border-[#1E2230] bg-[#0F1117] p-6">
          <h2 className="text-lg font-semibold text-white">
            The Dataset &amp; Enrichment
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Curated from the top 1,000 most-rated films in{" "}
            <strong className="text-zinc-200">MovieLens</strong> and enriched
            via the <strong className="text-zinc-200">TMDB API</strong> with
            full plot synopses, directors, top cast members, genres, runtimes,
            and thematic keywords.
          </p>
        </div>

        <div className="rounded-2xl border border-[#1E2230] bg-[#0F1117] p-6">
          <h2 className="text-lg font-semibold text-white">
            1. Smart Intent &amp; Filter Extraction
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            When you type a sentence like{" "}
            <em>&ldquo;around the 1990s, under 2 hours&rdquo;</em>, an LLM
            router separates hard database filters (year &amp; runtime bounds)
            from your thematic mood query in under 150ms.
          </p>
        </div>

        <div className="rounded-2xl border border-[#1E2230] bg-[#0F1117] p-6">
          <h2 className="text-lg font-semibold text-white">
            2. Dual Retrieval (Meaning + Keywords)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Inside{" "}
            <strong className="text-zinc-200">Supabase PostgreSQL</strong>, a
            single query fuses 768-dimensional semantic vectors (
            <code className="text-zinc-300">pgvector</code> HNSW) with weighted
            keyword search using Reciprocal Rank Fusion.
          </p>
        </div>

        <div className="rounded-2xl border border-[#1E2230] bg-[#0F1117] p-6">
          <h2 className="text-lg font-semibold text-white">
            3. Deep Reranking &amp; Watchlist Affinity
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            A cross-encoder model re-reads the top candidates against your full
            query to honor negations, while your saved Watchlist computes a
            personal taste centroid for tailored recommendations.
          </p>
        </div>
      </section>
    </div>
  );
}
