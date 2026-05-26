from datetime import date
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def generate_parcel_id(db: AsyncSession, country: str) -> str:
    country = country.upper()
    today = date.today()

    # Atomically upsert the counter row and increment seq.
    # INSERT ... ON CONFLICT takes a row-level lock, so concurrent calls
    # are serialised at the DB level — no duplicate IDs across pods.
    result = await db.execute(
        text("""
            INSERT INTO parcel_id_counters (country, day, seq)
            VALUES (:country, :day, 1)
            ON CONFLICT (country, day)
            DO UPDATE SET seq = parcel_id_counters.seq + 1
            RETURNING seq
        """),
        {"country": country, "day": today},
    )
    seq = result.scalar_one()
    return f"PCL-{today.strftime('%Y%m%d')}-{country}-{seq:05d}"
