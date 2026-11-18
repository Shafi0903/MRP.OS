#!/usr/bin/env bash
set -e

echo "=================================================="
echo " MRP.OS — Enterprise System Deployment Helper"
echo "=================================================="

# Check if .env exists, if not copy from .env.example
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
fi

MODE="${1:-postgres}"

# Detect docker compose command
if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
elif which docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
elif which podman-compose >/dev/null 2>&1; then
    COMPOSE="podman-compose"
else
    echo "Error: Neither 'docker compose', 'docker-compose', nor 'podman-compose' was found."
    exit 1
fi

if [ "$MODE" = "sqlite" ]; then
    echo "Deploying with SQLite database mode (lightweight)..."
    $COMPOSE -f docker-compose.sqlite.yml down || true
    $COMPOSE -f docker-compose.sqlite.yml build --no-cache
    $COMPOSE -f docker-compose.sqlite.yml up -d
    echo ""
    echo "MRP System deployed successfully in SQLite mode!"
    echo "Application UI: http://localhost:80"
    echo "API Docs:       http://localhost:80/docs"
elif [ "$MODE" = "stop" ]; then
    echo "Stopping MRP containers..."
    $COMPOSE down || true
    $COMPOSE -f docker-compose.sqlite.yml down || true
    echo "All containers stopped."
elif [ "$MODE" = "logs" ]; then
    $COMPOSE logs -f
else
    echo "Deploying with PostgreSQL database mode (recommended for production)..."
    $COMPOSE down || true
    $COMPOSE build --no-cache
    $COMPOSE up -d
    echo ""
    echo "Waiting for services to finish health checks..."
    sleep 5
    $COMPOSE ps
    echo ""
    echo "MRP System deployed successfully!"
    echo "Application UI: http://localhost:80"
    echo "API Swagger:    http://localhost:80/docs"
    echo "API ReDoc:      http://localhost:80/redoc"
    echo "Health Check:   http://localhost:80/api/health"
    echo ""
    echo "View logs with: ./deploy.sh logs  or  $COMPOSE logs -f"
fi
