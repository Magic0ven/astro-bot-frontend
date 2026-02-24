#!/bin/sh
# Railway start script for the FastAPI backend.
# Railway injects $PORT — uvicorn must bind to it.
echo "=== Astro-Bot API startup ==="
echo "PORT=${PORT:-8000}"
echo "DATABASE_URL set: ${DATABASE_URL:+yes}${DATABASE_URL:-NO — postgres features disabled}"
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --log-level info
