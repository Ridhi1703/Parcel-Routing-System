import os

# Provide required env vars for tests that import app modules.
# These are fake values — no real DB/broker connection is made in unit tests.
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")
os.environ.setdefault("DB_USER", "test")
os.environ.setdefault("DB_PASSWORD", "test")
os.environ.setdefault("DB_NAME", "test")
os.environ.setdefault("RABBITMQ_HOST", "localhost")
os.environ.setdefault("RABBITMQ_USER", "guest")
os.environ.setdefault("RABBITMQ_PASSWORD", "guest")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-not-used-in-prod")
