#!/bin/bash

# Script to rebuild and restart Docker containers for ATLAS
# Use: ./rebuild-docker.sh [--clean]

# Color codes for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if clean mode is requested
CLEAN_MODE=false
if [[ "$1" == "--clean" ]]; then
  CLEAN_MODE=true
  echo -e "${YELLOW}=== CLEAN REBUILD REQUESTED ===${NC}"
  echo -e "${YELLOW}This will remove all containers, volumes, and images related to ATLAS.${NC}"
  echo -e "${RED}Warning: All database data will be lost!${NC}"
  read -p "Are you sure you want to continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Cancelled clean rebuild.${NC}"
    exit 0
  fi
fi

echo -e "${BLUE}=== Stopping existing containers ===${NC}"
docker-compose down

if [ "$CLEAN_MODE" = true ]; then
  echo -e "${YELLOW}=== Removing volumes (clean mode) ===${NC}"
  docker-compose down -v
  
  echo -e "${YELLOW}=== Removing related Docker images ===${NC}"
  docker images | grep atlas-app | awk '{print $3}' | xargs -r docker rmi
  
  echo -e "${YELLOW}=== Cleaning up Docker system ===${NC}"
  docker system prune -f
fi

echo -e "${BLUE}=== Rebuilding containers without cache ===${NC}"
docker-compose build --no-cache

echo -e "${BLUE}=== Starting containers ===${NC}"
docker-compose up -d

echo -e "${BLUE}=== Following logs ===${NC}"
echo -e "${YELLOW}Press Ctrl+C to exit logs (containers will continue running)${NC}"
docker-compose logs -f

echo -e "${GREEN}=== To stop containers, run: docker-compose down ===${NC}" 