from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

_engine = None
_AsyncSessionLocal = None


def _get_engine():
    global _engine, _AsyncSessionLocal
    if _engine is None:
        from app.config import get_settings

        _engine = create_async_engine(get_settings().database_url, echo=False)
        _AsyncSessionLocal = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine, _AsyncSessionLocal


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore
    _, session_factory = _get_engine()
    async with session_factory() as session:
        yield session
