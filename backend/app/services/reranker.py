import voyageai
from app.config import get_settings


def rerank_candidates(query: str, candidates: list[dict], top_k: int = 12) -> list[dict]:
    """Re-scores top RRF candidates via Voyage AI rerank-2.5-lite cross-encoder."""
    if not candidates:
        return []

    client = voyageai.Client(api_key=get_settings().voyage_api_key)
    docs = [c["search_doc"] for c in candidates]

    reranked = client.rerank(
        query=query,
        documents=docs,
        model="rerank-2.5-lite",
        top_k=min(top_k, len(candidates)),
    )

    ordered: list[dict] = []
    for item in reranked.results:
        row = dict(candidates[item.index])
        row["rerank_score"] = round(float(item.relevance_score), 4)
        ordered.append(row)
    return ordered