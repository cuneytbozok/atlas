#!/bin/bash

# Script to run add_token_usage_fields.sql in the Docker PostgreSQL container
# This script will add token tracking fields to the database tables

# Color codes for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Running SQL script to add token usage fields ===${NC}"

# Check if the SQL file exists
if [ ! -f "./add_token_usage_fields.sql" ]; then
  echo -e "${RED}Error: add_token_usage_fields.sql file not found in the current directory${NC}"
  exit 1
fi

# Copy the SQL file to the postgres container
echo -e "${BLUE}=== Copying SQL file to PostgreSQL container ===${NC}"
docker cp ./add_token_usage_fields.sql atlas-postgres:/tmp/add_token_usage_fields.sql

if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Failed to copy SQL file to container. Is the Docker container running?${NC}"
  echo -e "${YELLOW}Tip: Run ./rebuild-docker.sh if containers are not running${NC}"
  exit 1
fi

# Execute the SQL script in the database
echo -e "${BLUE}=== Executing SQL script in the database ===${NC}"
docker exec atlas-postgres psql -U postgres -d atlas -f /tmp/add_token_usage_fields.sql

if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Failed to execute SQL script in the database${NC}"
  exit 1
else
  echo -e "${GREEN}=== Token usage fields have been successfully added to the database! ===${NC}"
  echo -e "${GREEN}=== Token usage tracking is now enabled in ATLAS ===${NC}"
  
  # Restart the Atlas app container to ensure changes take effect
  echo -e "${BLUE}=== Restarting Atlas application to apply changes ===${NC}"
  docker restart atlas-app
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Warning: Could not restart atlas-app container${NC}"
  else
    echo -e "${GREEN}=== Atlas application restarted successfully ===${NC}"
    echo -e "${GREEN}=== Token usage statistics will now be available in the Insights page ===${NC}"
  fi
fi

# Remove the temporary file from the container
docker exec atlas-postgres rm /tmp/add_token_usage_fields.sql > /dev/null 2>&1 