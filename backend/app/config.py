from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path

# Always resolve .env relative to repo root (two levels up from this file:
# app/config.py → app/ → backend/ → ParcelFlow/)
_ENV_FILE = Path(__file__).parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore"
    )

    # ── PostgreSQL ────────────────────────────────────────────────────────────
    db_host: str
    db_port: int = 5432
    db_user: str
    db_password: str
    db_name: str
    db_ssl: bool = False

    # ── RabbitMQ ──────────────────────────────────────────────────────────────
    rabbitmq_host: str
    rabbitmq_port: int = 5672
    rabbitmq_user: str
    rabbitmq_password: str
    rabbitmq_vhost: str = "/"
    rabbitmq_ssl: bool = False

    # ── JWT ───────────────────────────────────────────────────────────────────
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 8
    jwt_refresh_expire_days: int = 7

    # ── Derived URLs (computed, never set directly) ───────────────────────────
    @computed_field
    @property
    def database_url(self) -> str:
        ssl = "?ssl=require" if self.db_ssl else ""
        return f"postgresql+asyncpg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}{ssl}"

    @computed_field
    @property
    def sync_database_url(self) -> str:
        ssl = "?ssl=require" if self.db_ssl else ""
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}{ssl}"

    @computed_field
    @property
    def rabbitmq_url(self) -> str:
        scheme = "amqps" if self.rabbitmq_ssl else "amqp"
        vhost = self.rabbitmq_vhost.lstrip("/")
        return f"{scheme}://{self.rabbitmq_user}:{self.rabbitmq_password}@{self.rabbitmq_host}:{self.rabbitmq_port}/{vhost}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
