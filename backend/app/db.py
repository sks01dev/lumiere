from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from app.config import get_settings

_pool: AsyncConnectionPool | None = None


async def init_db_pool() -> None:
    global _pool
    settings = get_settings()
    _pool = AsyncConnectionPool(
        conninfo=settings.supabase_db_url,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row, "prepare_threshold": None},
        open=False,
    )
    await _pool.open()


async def close_db_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> AsyncConnectionPool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized.")
    return _pool