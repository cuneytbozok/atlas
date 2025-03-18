#!/bin/bash

# Script to check the status of Docker containers for ATLAS

echo "=== Docker Container Status ==="
docker-compose ps

echo ""
echo "=== Container Logs (last 20 lines) ==="
docker-compose logs --tail=20

echo ""
echo "=== Database Status ==="
docker exec -it atlas-postgres pg_isready -U postgres || echo "PostgreSQL container not running"

echo ""
echo "=== Application Health Check ==="
curl -s http://localhost:3000/api/health | jq || echo "Health check endpoint not accessible. Full response:" && curl -v http://localhost:3000/api/health 2>&1 || echo "Health check endpoint not reachable"

echo ""
echo "=== Connection Test ==="
echo "Testing connection to PostgreSQL from host:"
if command -v pg_isready &> /dev/null; then
  pg_isready -h localhost -p 5432 -U postgres
else
  echo "pg_isready command not available on host"
fi
