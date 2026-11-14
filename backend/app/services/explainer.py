import json
from groq import AsyncGroq
from app.config import get_settings
from app.schemas import ExplainItem, ExplainMovieInput

_EXPLAIN_CACHE: dict[tuple[str, int], str] = {}


async def generate_explanations(query: str, movies: list[ExplainMovieInput]) -> list[ExplainItem]:
    """Batches top movies into ONE Groq JSON call to save 3x RPM quota and caches results."""
    norm_q = query.strip().lower()
    results: list[ExplainItem] = []
    uncached: list[ExplainMovieInput] = []

    for m in movies:
        cached = _EXPLAIN_CACHE.get((norm_q, m.id))
        if cached:
            results.append(ExplainItem(id=m.id, reason=cached))
        else:
            uncached.append(m)

    if not uncached:
        return results

    movie_lines = "\n".join(
        f'- id={m.id} | title="{m.title}" | plot="{m.overview[:220]}"' for m in uncached
    )
    prompt = (
        f'User search: "{query}"\n'
        f"Movies:\n{movie_lines}\n\n"
        'Return strict JSON: {"explanations": [{"id": <int>, "reason": "<one crisp sentence explaining why this movie fits the user\'s vibe/constraints>"}]}'
    )

    client = AsyncGroq(api_key=get_settings().groq_api_key)
    try:
        resp = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=260,
        )
        payload = json.loads(resp.choices[0].message.content or "{}")
        for item in payload.get("explanations", []):
            mid = int(item["id"])
            reason = str(item["reason"]).strip()
            _EXPLAIN_CACHE[(norm_q, mid)] = reason
            results.append(ExplainItem(id=mid, reason=reason))
    except Exception:
        for m in uncached:
            results.append(
                ExplainItem(id=m.id, reason=f"Strong semantic and thematic alignment with '{query}'.")
            )

    return results