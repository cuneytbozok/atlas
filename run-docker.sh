#!/bin/bash
# ATLAS Docker Deployment Script
# This script builds and runs the ATLAS application in Docker

set -e

# Color codes for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 ATLAS Docker Deployment${NC}"
echo "================================================"

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if .env.docker file exists
if [ ! -f .env.docker ]; then
    echo -e "${YELLOW}⚠️ .env.docker file not found. Creating default one...${NC}"
    cp .env.example .env.docker || { echo -e "${RED}❌ Failed to create .env.docker file${NC}"; exit 1; }
    echo -e "${GREEN}✅ Created .env.docker file${NC}"
fi

# Ask for OpenAI API key if not set
grep -q "OPENAI_API_KEY=\"sk-" .env.docker
if [ $? -eq 0 ]; then
    echo -e "${YELLOW}⚠️ OpenAI API key not set (or is a placeholder).${NC}"
    read -p "Do you want to add your OpenAI API key now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your OpenAI API key: " openai_key
        sed -i.bak "s|OPENAI_API_KEY=\"sk-placeholder-for-docker-build-only\"|OPENAI_API_KEY=\"$openai_key\"|g" .env.docker
        rm .env.docker.bak
        echo -e "${GREEN}✅ OpenAI API key updated${NC}"
    else
        echo -e "${YELLOW}⚠️ Continuing with placeholder API key. AI features won't work until a valid key is set.${NC}"
    fi
fi

echo -e "${BLUE}🔄 Building ATLAS Docker containers...${NC}"
docker-compose build --no-cache

# Check if build was successful
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Please check the errors above.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful!${NC}"
echo -e "${BLUE}🔄 Starting containers...${NC}"
docker-compose up -d

# Check if containers started successfully
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start containers. Please check the errors above.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Containers started successfully!${NC}"

# Wait for the application to be ready
echo -e "${BLUE}🔄 Waiting for ATLAS to be ready...${NC}"
attempt_num=0
max_attempts=30

until curl -s http://localhost:3000/api/health > /dev/null || [ $attempt_num -eq $max_attempts ]; do
    echo -e "${YELLOW}⏳ Waiting for ATLAS to be ready... ($((attempt_num+1))/$max_attempts)${NC}"
    attempt_num=$((attempt_num+1))
    sleep 2
done

if [ $attempt_num -eq $max_attempts ]; then
    echo -e "${YELLOW}⚠️ ATLAS is taking longer than expected to start. It might still be initializing.${NC}"
    echo -e "${YELLOW}⚠️ Check logs with: docker-compose logs -f${NC}"
else
    echo -e "${GREEN}✅ ATLAS is ready!${NC}"
fi

echo "================================================"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${BLUE}🌐 You can access ATLAS at: http://localhost:3000${NC}"
echo -e "${BLUE}📝 Default admin credentials:${NC}"
echo -e "   Email: ${YELLOW}admin@atlas.com${NC}"
echo -e "   Password: ${YELLOW}password${NC}"
echo -e "${RED}⚠️ Please change the default admin password after first login!${NC}"
echo -e "${GREEN}Note: No dummy data or test users have been created per your preference.${NC}"
echo
echo -e "${BLUE}📋 Useful commands:${NC}"
echo -e "  ${YELLOW}View logs:${NC} docker-compose logs -f"
echo -e "  ${YELLOW}Stop containers:${NC} docker-compose down"
echo -e "  ${YELLOW}Restart containers:${NC} docker-compose restart"
echo "================================================" 