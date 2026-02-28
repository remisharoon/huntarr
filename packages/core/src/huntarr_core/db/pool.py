from __future__ import annotations

from pathlib import Path

import asyncpg


async def create_db_pool(database_url: str) -> asyncpg.Pool:
    return await asyncpg.create_pool(dsn=database_url, min_size=1, max_size=10)


async def init_db_schema(pool: asyncpg.Pool) -> None:
    schema_path = Path(__file__).with_name("schema.sql")
    sql = schema_path.read_text(encoding="utf-8")
    async with pool.acquire() as conn:
        await conn.execute(sql)
