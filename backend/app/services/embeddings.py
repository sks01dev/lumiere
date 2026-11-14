from functools import lru_cache
import numpy as np
from google import genai
from google.genai import types
from app.config import get_settings


def _l2_normalize(vec: list[float]) -> list[float]:
    arr = np.array(vec, dtype=np.float32)
    norm = float(np.linalg.norm(arr))
    return (arr / norm).tolist() if norm > 0.0 else arr.tolist()


@lru_cache(maxsize=256)
def embed_query_cached(query: str) -> tuple[float, ...]:
    """Embeds a search query into a normalized 768-d vector and caches it in RAM."""
    client = genai.Client(api_key=get_settings().gemini_api_key)
    response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=query,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=768,
        ),
    )
    return tuple(_l2_normalize(response.embeddings[0].values))