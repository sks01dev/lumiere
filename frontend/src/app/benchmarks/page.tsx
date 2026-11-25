import { CheckCircle2, XCircle } from "lucide-react";
import { fetchBenchmarks } from "@/lib/api";

const FRIENDLY_NAMES: Record<string, string> = {
  "Sparse Lexical (tsvector)": "1. Standard Keyword Search",
  "Dense Vector (pgvector HNSW)": "2. AI Semantic Search",
  "Hybrid RRF (k=60)": "3. Hybrid Fusion (Keywords + Meaning)",
  "Hybrid RRF + Voyage Rerank": "4. Hybrid + Deep Context Reranking",
};

export default async function BenchmarksPage() {
  const data = await fetchBenchmarks();

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-[#1E2230] bg-[#0F1117] p-6 sm:p-10">
        <h1
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          className="text-3xl font-bold text-white"
        >
          Search Quality Benchmarks
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          How do we know Lumière finds the right film? We tested four search
          architectures side by side across{" "}
          <strong className="text-zinc-200">{data.corpus_size} films</strong>{" "}
          and{" "}
          <strong className="text-zinc-200">
            {data.num_queries} real-world queries
          </strong>{" "}
          involving plot descriptions, runtime limits, and exclusions.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 w-full min-w-0">
          <div className="rounded-2xl border border-[#1E2230] bg-[#07080B] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#EAB308]">
              Top-3 Accuracy (Hit@3)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              How often the exact target movie appears in the very first row of
              results.
            </p>
          </div>
          <div className="rounded-2xl border border-[#1E2230] bg-[#07080B] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#EAB308]">
              First-Match Rank (MRR@10)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Measures how close to #1 the best match lands (1.00 = always #1).
            </p>
          </div>
          <div className="rounded-2xl border border-[#1E2230] bg-[#07080B] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#EAB308]">
              Ranking Quality (nDCG@10)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Overall ordering accuracy across the top 10 recommended films.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {data.ablation_table.map((row) => (
            <div
              key={row.stage}
              className="rounded-2xl border border-[#1E2230] bg-[#07080B] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 w-full min-w-0">
                <span className="text-sm font-semibold text-white">
                  {FRIENDLY_NAMES[row.stage] || row.stage}
                </span>
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 w-full min-w-0">
                  <span>
                    Top-3 Accuracy:{" "}
                    <strong className="text-[#EAB308]">
                      {row.hit_at_3.toFixed(1)}%
                    </strong>
                  </span>
                  <span>
                    MRR:{" "}
                    <strong className="text-zinc-200">
                      {row.mrr_at_10.toFixed(3)}
                    </strong>
                  </span>
                  <span>
                    nDCG:{" "}
                    <strong className="text-zinc-200">
                      {row.ndcg_at_10.toFixed(3)}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full rounded-full bg-[#EAB308]"
                  style={{ width: `${Math.min(100, row.hit_at_3)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2
          style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          className="text-2xl font-bold text-white"
        >
          Why Traditional Search Fails (Real Examples)
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 w-full min-w-0">
          {data.case_studies.map((cs) => (
            <div
              key={cs.query}
              className="rounded-2xl border border-[#1E2230] bg-[#0F1117] p-6"
            >
              <p className="text-xs font-semibold text-[#EAB308]">
                Search: &ldquo;{cs.query}&rdquo;
              </p>

              <div className="mt-4 flex items-start gap-2.5 text-sm text-zinc-400 w-full min-w-0">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div>
                  <span className="font-semibold text-zinc-200">
                    Keyword Search:{" "}
                  </span>
                  {cs.sparse_issue}
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2.5 text-sm text-zinc-300 w-full min-w-0">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <span className="font-semibold text-white">Lumière: </span>
                  {cs.hybrid_rerank_win}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
