import time
import voyageai
from voyageai.error import RateLimitError
from app.config import get_settings

_RERANK_CACHE: dict[tuple[str, tuple[int, ...], int], list[dict]] = {}


def rerank_candidates(
    query: str,
    candidates: list[dict],
    top_k: int = 12,
    retry_on_rate_limit: bool = False,
) -> list[dict]:
    """Re-scores top RRF candidates via Voyage AI rerank-2.5-lite with metadata & RRF score anchoring."""
    if not candidates:
        return []

    cache_key = (query.strip().lower(), tuple(c["id"] for c in candidates), top_k)
    if cache_key in _RERANK_CACHE:
        return [dict(item) for item in _RERANK_CACHE[cache_key]]

    client = voyageai.Client(api_key=get_settings().voyage_api_key)
    docs = [
        f"{c['title']} ({c.get('release_year') or 'N/A'}) | Dir: {c.get('director') or 'N/A'} | "
        f"Cast: {', '.join((c.get('cast_names') or [])[:3])} | Genres: {', '.join(c.get('genres') or [])} | "
        f"{(c.get('overview') or '')[:320]}"
        for c in candidates
    ]

    max_rrf = max((float(c.get("rrf_score") or 0.0) for c in candidates), default=1.0) or 1.0

    for attempt in range(3 if retry_on_rate_limit else 1):
        try:
            reranked = client.rerank(
                query=query,
                documents=docs,
                model="rerank-2.5-lite",
                top_k=len(candidates),
            )
            scored: list[dict] = []
            for item in reranked.results:
                row = dict(candidates[item.index])
                ce_score = float(item.relevance_score)
                rrf_norm = float(row.get("rrf_score") or 0.0) / max_rrf
                blended = round(0.80 * ce_score + 0.20 * rrf_norm, 4)
                row["rerank_score"] = round(ce_score, 4)
                row["_blended_score"] = blended
                scored.append(row)

            scored.sort(key=lambda x: x["_blended_score"], reverse=True)
            ordered = [{k: v for k, v in r.items() if k != "_blended_score"} for r in scored[:top_k]]

            _RERANK_CACHE[cache_key] = ordered
            return [dict(item) for item in ordered]
        except RateLimitError:
            if retry_on_rate_limit and attempt < 2:
                print("      [Voyage 3 RPM Limit] Sleeping 22s before retry...")
                time.sleep(22.0)
                continue
            return [dict(c, rerank_score=None) for c in candidates[:top_k]]

    return [dict(c, rerank_score=None) for c in candidates[:top_k]]