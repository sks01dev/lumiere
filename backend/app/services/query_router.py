import json
import re
from groq import AsyncGroq
from app.config import get_settings
from app.schemas import ExtractedFilters

SYSTEM_PROMPT = """You are a search query router for a movie discovery engine.
Extract hard metadata filters ONLY if explicitly implied by the query, and keep the remaining thematic/vibe intent in `semantic_query`.
Return strict JSON with keys:
- "semantic_query": string (keep negations like "not sad" and genres/vibes intact; never empty)
- "year_min": integer or null (e.g. "90s" -> 1990, "around the 1990s" -> 1988, "early 2000s" -> 2000)
- "year_max": integer or null (e.g. "90s" -> 1999, "around the 1990s" -> 2001, "before 1985" -> 1984)
- "max_runtime": integer or null (in minutes, e.g. "under 2 hours" -> 120, "short film under 95 mins" -> 95)
- "min_rating": float or null (e.g. "critically acclaimed" -> 7.5, "masterpiece" -> 8.0)
"""


def _regex_fallback_filters(query: str) -> ExtractedFilters:
    """Deterministic constraint extractor if Groq API key is missing or rate-limited."""
    q = query.lower()
    year_min, year_max, max_runtime, min_rating = None, None, None, None

    # Decade matching: "around the 1990s" -> 1988..2001, "1990s" / "90s" -> 1990..1999
    decade_match = re.search(r"(around\s+(?:the\s+)?)?(19\d0|20\d0)s\b", q)
    if decade_match:
        approx = bool(decade_match.group(1))
        base_year = int(decade_match.group(2))
        year_min = base_year - 2 if approx else base_year
        year_max = base_year + 11 if approx else base_year + 9

    # Runtime matching: "under 2 hours" or "under 110 min"
    hr_match = re.search(r"(?:under|less than|<)\s*(\d+(?:\.\d+)?)\s*hours?", q)
    min_match = re.search(r"(?:under|less than|<)\s*(\d+)\s*(?:mins?|minutes?)", q)
    if hr_match:
        max_runtime = int(float(hr_match.group(1)) * 60)
    elif min_match:
        max_runtime = int(min_match.group(1))

    if any(w in q for w in ("masterpiece", "top rated", "acclaimed")):
        min_rating = 7.5

    return ExtractedFilters(
        year_min=year_min,
        year_max=year_max,
        max_runtime=max_runtime,
        min_rating=min_rating,
    )


async def route_query(raw_query: str) -> tuple[str, ExtractedFilters]:
    """Parses natural language into semantic intent + hard SQL filters via Groq Llama 3.1 8B."""
    client = AsyncGroq(api_key=get_settings().groq_api_key)
    try:
        completion = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Parse this search query into JSON: {raw_query}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=150,
        )
        data = json.loads(completion.choices[0].message.content or "{}")
        semantic = (data.get("semantic_query") or raw_query).strip()
        filters = ExtractedFilters(
            year_min=data.get("year_min"),
            year_max=data.get("year_max"),
            max_runtime=data.get("max_runtime"),
            min_rating=data.get("min_rating"),
        )
        return semantic, filters
    except Exception:
        return raw_query.strip(), _regex_fallback_filters(raw_query)