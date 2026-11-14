from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    supabase_db_url: str
    gemini_api_key: str
    groq_api_key: str
    voyage_api_key: str
    tmdb_api_key: str = ""

    model_config = SettingsConfigDict(env_file=str(ENV_PATH), extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()