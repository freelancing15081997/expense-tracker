import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from scripts._inspect_core import normalize


async def main() -> None:
    url = normalize(os.environ["DATABASE_URL"])
    eng = create_async_engine(url)
    async with eng.connect() as c:
        r = await c.execute(
            text(
                "SELECT table_schema, table_name FROM information_schema.tables "
                "WHERE table_schema IN ('biz','business') ORDER BY 1,2"
            )
        )
        print("=== tables")
        for schema, name in r:
            print(f"  {schema}.{name}")
        for schema, table in (("biz", "parties"), ("biz", "documents"), ("biz", "document_lines")):
            r = await c.execute(
                text(
                    "SELECT column_name, data_type FROM information_schema.columns "
                    "WHERE table_schema=:s AND table_name=:t ORDER BY ordinal_position"
                ),
                {"s": schema, "t": table},
            )
            cols = list(r)
            print(f"=== {schema}.{table} count {len(cols)}")
            for name, dt in cols:
                print(f"  {name} {dt}")
    await eng.dispose()


if __name__ == "__main__":
    asyncio.run(main())
