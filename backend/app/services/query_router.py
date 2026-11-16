import json
import re
from groq import AsyncGroq
from app.config import get_settings
from app.schemas import ExtractedFilters

_ROUTER_CACHE: dict[str, tuple[str, ExtractedFilters]] = {}


def _parse_compound_runtime_minutes(q: str) -> int | None:
    prefix = r"(?:under|less\s+than|below|max(?:imum)?|within|no\s+longer\s+than|shorter\s+than|at\s+most|<=|<)\s*"

    # Compound hours + minutes: e.g. "under 2 hours 15 minutes", "2 hr 15 min", "2h 15m"
    m_compound = re.search(
        rf"(?:{prefix})?(\d+)\s*(?:hr|hrs|hour|hours|h)\s*(?:and\s*)?(\d{{1,2}})\s*(?:m|min|mins|minute|minutes)\b",
        q,
    )
    if m_compound:
        return int(m_compound.group(1)) * 60 + int(m_compound.group(2))

    # Decimal or integer hours: e.g. "under 2 hours", "under 1.5 hrs"
    m_hr = re.search(
        rf"{prefix}(\d+(?:\.\d+)?)\s*(?:hr|hrs|hour|hours|h)\b",
        q,
    )
    if m_hr:
        return int(round(float(m_hr.group(1)) * 60))

    # Minutes only: e.g. "under 135 minutes", "less than 95 min"
    m_min = re.search(
        rf"{prefix}(\d{{2,3}})\s*(?:m|min|mins|minute|minutes)\b",
        q,
    )
    if m_min:
        return int(m_min.group(1))

    return None


def _extract_deterministic_filters(query: str) -> ExtractedFilters:
    q = query.lower()
    year_min: int | None = None
    year_max: int | None = None
    min_rating: float | None = None

    m_before = re.search(
        r"\b(?:before|prior\s+to|pre[-\s]?|older\s+than|until|up\s+to)\s*(?:the\s+year\s+|year\s+)?(19\d{2}|20\d{2})\b",
        q,
    )
    if m_before:
        phrase = m_before.group(0)
        exclusive = any(w in phrase for w in ("before", "prior", "pre", "older"))
        year_max = int(m_before.group(1)) - (1 if exclusive else 0)

    m_after = re.search(
        r"\b(?:after|since|post[-\s]?|newer\s+than|from)\s*(?:the\s+year\s+|year\s+)?(19\d{2}|20\d{2})\b",
        q,
    )
    if m_after and not re.search(r"\bfrom\s+\d{4}\s*(?:-|to)\s*\d{4}\b", q):
        phrase = m_after.group(0)
        exclusive = any(w in phrase for w in ("after", "post", "newer"))
        year_min = int(m_after.group(1)) + (1 if exclusive else 0)

    m_range = re.search(r"\b(19\d{2}|20\d{2})\s*(?:-|to|through)\s*(19\d{2}|20\d{2})\b", q)
    if m_range:
        year_min, year_max = int(m_range.group(1)), int(m_range.group(2))

    if year_min is None and year_max is None:
        m_dec = re.search(r"\b(?:(19|20)?(\d0))s\b", q)
        if m_dec:
            century = int(m_dec.group(1)) if m_dec.group(1) else (19 if int(m_dec.group(2)) >= 30 else 20)
            start = century * 100 + int(m_dec.group(2))
            if "around" in q:
                year_min, year_max = start - 2, start + 11
            else:
                year_min, year_max = start, start + 9

    max_runtime = _parse_compound_runtime_minutes(q)

    m_rat = re.search(r"\b(?:rated|rating|score)\s*(?:above|over|>=|>)?\s*(\d(?:\.\d)?)\b", q)
    if m_rat:
        min_rating = float(m_rat.group(1))

    return ExtractedFilters(
        year_min=year_min,
        year_max=year_max,
        max_runtime=max_runtime,
        min_rating=min_rating,
    )


def _strip_constraint_phrases(query: str) -> str:
    cleaned = re.sub(
        r"\b(?:under|less\s+than|below|max(?:imum)?|within|no\s+longer\s+than|shorter\s+than|at\s+most)?\s*\d+\s*(?:hr|hrs|hour|hours|h)\s*(?:and\s*)?\d{1,2}\s*(?:m|min|mins|minute|minutes)\b",
        "",
        query,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"\b(?:under|less\s+than|below|max(?:imum)?|within)\s+\d+(?:\.\d+)?\s*(?:hr|hrs|hour|hours|h|m|min|mins|minute|minutes)\b",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"\b(?:before|prior\s+to|after|since|from)\s+(?:the\s+year\s+|year\s+)?(?:19\d{2}|20\d{2})\b",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" ,.-")
    return cleaned or query.strip()


async def route_query(raw_query: str) -> tuple[str, ExtractedFilters]:
    key = raw_query.strip().lower()
    if key in _ROUTER_CACHE:
        return _ROUTER_CACHE[key]

    det_filters = _extract_deterministic_filters(raw_query)
    fallback_semantic = _strip_constraint_phrases(raw_query)
    settings = get_settings()

    if not settings.groq_api_key:
        res = (fallback_semantic, det_filters)
        _ROUTER_CACHE[key] = res
        return res

    client = AsyncGroq(api_key=settings.groq_api_key)
    system_prompt = (
        "Extract structured metadata filters from a movie search query and return ONLY valid JSON with keys: "
        '"semantic_query" (string: clean thematic/plot query without year/runtime numbers), '
        '"year_min" (int or null), "year_max" (int or null), '
        '"max_runtime" (total integer minutes or null, e.g., "2 hours 15 minutes" -> 135), "min_rating" (float or null). '
        'For "before 2000", set year_max=1999. For "after 2010", set year_min=2011. '
        'For "around the 1990s", set year_min=1988, year_max=2001.'
    )

    try:
        completion = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": raw_query},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=180,
        )
        parsed = json.loads(completion.choices[0].message.content or "{}")
        semantic_q = (parsed.get("semantic_query") or fallback_semantic).strip()

        merged_filters = ExtractedFilters(
            year_min=det_filters.year_min if det_filters.year_min is not None else parsed.get("year_min"),
            year_max=det_filters.year_max if det_filters.year_max is not None else parsed.get("year_max"),
            max_runtime=det_filters.max_runtime if det_filters.max_runtime is not None else parsed.get("max_runtime"),
            min_rating=det_filters.min_rating if det_filters.min_rating is not None else parsed.get("min_rating"),
        )
        res = (semantic_q, merged_filters)
        _ROUTER_CACHE[key] = res
        return res
    except Exception:
        res = (fallback_semantic, det_filters)
        _ROUTER_CACHE[key] = res
        return res
