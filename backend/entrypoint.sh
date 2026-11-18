#!/bin/sh
set -e

echo "=== Starting MRP Backend Deployment ==="

# If PostgreSQL is configured, wait for DB readiness
if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "postgres"; then
    echo "Waiting for PostgreSQL database to become available..."
    python - << 'EOF'
import sys
import time
import os
from sqlalchemy import create_engine

url = os.environ.get("DATABASE_URL", "")
max_attempts = 30
for attempt in range(1, max_attempts + 1):
    try:
        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as conn:
            print(f"Database connection verified successfully on attempt {attempt}.")
            sys.exit(0)
    except Exception as exc:
        print(f"Waiting for DB ({attempt}/{max_attempts})... error: {exc}")
        time.sleep(1)
print("Timed out waiting for database connection.")
sys.exit(1)
EOF
fi

# Run database migrations
echo "Applying database schema migrations (Alembic)..."
alembic upgrade head

# Run demo seeding if enabled
if [ "${SEED_DEMO:-true}" = "true" ]; then
    echo "Seeding demo Indian manufacturing data (idempotent)..."
    python scripts/seed_demo.py || echo "Warning: Demo seed script encountered existing data or error, continuing."
fi

# Launch FastAPI app with Uvicorn
echo "Launching FastAPI application on 0.0.0.0:8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers "${UVICORN_WORKERS:-2}"
