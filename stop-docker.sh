#!/bin/bash

# Script to stop Docker containers for ATLAS

echo "=== Stopping Docker containers ==="
docker-compose down

echo "=== Current Docker container status ==="
docker-compose ps

echo ""
echo "=== To restart containers, run: ./rebuild-docker.sh ==="
