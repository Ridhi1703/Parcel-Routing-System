FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy source first (uv needs pyproject.toml)
COPY pyproject.toml ./
COPY app/ ./app/

# Install production deps into system Python
RUN uv pip install --system \
    "fastapi>=0.111.0" \
    "uvicorn[standard]>=0.29.0" \
    "sqlalchemy[asyncio]>=2.0.0" \
    "asyncpg>=0.29.0" \
    "alembic>=1.13.0" \
    "celery[rabbitmq]>=5.4.0" \
    "pydantic>=2.7.0" \
    "pydantic-settings>=2.2.0" \
    "python-jose[cryptography]>=3.3.0" \
    "passlib[bcrypt]>=1.7.4" \
    "python-multipart>=0.0.9" \
    "httpx>=0.27.0" \
    "psycopg2-binary>=2.9.0"

# Copy rest of source
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
