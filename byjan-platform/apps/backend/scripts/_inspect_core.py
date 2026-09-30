import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


def normalize(url: str) -> str:
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    for token in (
        "sslmode=require",
        "sslmode=verify-full",
        "sslmode=prefer",
        "channel_binding=require",
    ):
        url = url.replace(token, "")
    url = url.replace("?&", "?").replace("&&", "&").rstrip("?&")
    if "ssl=" not in url:
        url += ("&" if "?" in url else "?") + "ssl=require"
    return url


async def main() -> None:
    url = normalize(os.environ["DATABASE_URL"])
    eng = create_async_engine(url)
    async with eng.connect() as c:
        for table in ("users", "sessions", "tenants", "memberships", "roles"):
            r = await c.execute(
                text(
                    "SELECT column_name, data_type FROM information_schema.columns "
                    "WHERE table_schema='core' AND table_name=:t ORDER BY ordinal_position"
                ),
                {"t": table},
            )
            cols = list(r)
            print("===", table, "count", len(cols))
            for name, dt in cols:
                print(" ", name, dt)
    await eng.dispose()


if __name__ == "__main__":
    asyncio.run(main())
