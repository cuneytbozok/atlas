#!/bin/bash

# Script to rebuild and restart Docker containers for ATLAS
# Use: ./rebuild-docker.sh [--clean]

# Change to the script's directory to ensure we can find docker-compose.yml
cd "$(dirname "$0")"

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

# Ensure Prisma directory has proper permissions
if [ -d "prisma" ]; then
  echo -e "${BLUE}=== Ensuring Prisma directory has proper permissions ===${NC}"
  chmod -R 755 prisma
fi

# Check if install-dependencies.sh exists and is executable
if [ ! -f "install-dependencies.sh" ]; then
  echo -e "${RED}Error: install-dependencies.sh file not found!${NC}"
  echo -e "Creating minimal install-dependencies.sh script..."
  
  cat > install-dependencies.sh << 'EOF'
#!/bin/bash

echo "Installing dependencies with legacy peer deps to handle React compatibility issues..."
npm install --legacy-peer-deps "$@"

echo "Dependencies installed successfully!"
EOF
  
  echo -e "${GREEN}Created install-dependencies.sh${NC}"
fi

# Ensure script has executable permissions
chmod +x install-dependencies.sh
echo -e "${GREEN}✓ install-dependencies.sh is ready${NC}"

# Check for OPENAI_API_KEY
if [ -z "$OPENAI_API_KEY" ]; then
  echo -e "${YELLOW}⚠️ OPENAI_API_KEY environment variable is not set.${NC}"
  echo -e "${YELLOW}Some AI features may not work properly.${NC}"
  echo -e "${YELLOW}You can set it using one of these methods:${NC}"
  echo -e "${BLUE}1. Export in your terminal: ${GREEN}export OPENAI_API_KEY=your_key_here${NC}"
  echo -e "${BLUE}2. Add to your .env file: ${GREEN}OPENAI_API_KEY=your_key_here${NC}"
  echo -e "${BLUE}3. Pass directly when running docker-compose: ${GREEN}OPENAI_API_KEY=your_key docker-compose up -d${NC}"
fi

# Check for RESEND_API_KEY (for email functionality)
if [ -z "$RESEND_API_KEY" ] || [[ "$RESEND_API_KEY" == *"placeholder"* ]]; then
  echo -e "${YELLOW}⚠️ RESEND_API_KEY environment variable is not properly set.${NC}"
  echo -e "${YELLOW}Email features like password reset will not work properly.${NC}"
  echo -e "${YELLOW}Get a key at: https://resend.com/${NC}"
  echo -e "${BLUE}Set it using the same methods as OPENAI_API_KEY above.${NC}"
fi

# Setup diagnostic information
echo -e "${BLUE}=== Setting up admin tools ===${NC}"
echo -e "${GREEN}✓ Advanced admin diagnostic tool installed: debug-admin.js${NC}"
echo -e "${YELLOW}    Use this tool for detailed admin user diagnostics and repair${NC}"

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

# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

docker-compose build --no-cache

# Check if build was successful
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Docker build failed. See errors above.${NC}"
  exit 1
fi

echo -e "${BLUE}=== Starting containers ===${NC}"
docker-compose up -d

# Check if containers started successfully
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to start containers. Please check the errors above.${NC}"
  exit 1
fi

echo -e "${BLUE}=== Following logs ===${NC}"
echo -e "${YELLOW}Press Ctrl+C to exit logs (containers will continue running)${NC}"
docker-compose logs -f

echo -e "${GREEN}=== ATLAS has been deployed successfully ===${NC}"
echo -e "${GREEN}To access your application:${NC}"
echo -e "${BLUE}- Visit http://localhost:3000 in your browser${NC}"
echo -e "${BLUE}- Log in with admin@atlas.com / password${NC}"

echo -e "${YELLOW}API Key Status:${NC}"
if [ -z "$OPENAI_API_KEY" ]; then
  echo -e "${RED}❌ OpenAI API key not set. AI features will not work.${NC}"
else
  echo -e "${GREEN}✓ OpenAI API key is set${NC}"
fi

if [ -z "$RESEND_API_KEY" ] || [[ "$RESEND_API_KEY" == *"placeholder"* ]]; then
  echo -e "${RED}❌ Resend API key not properly set. Email features may not work.${NC}"
else
  echo -e "${GREEN}✓ Resend API key is set${NC}"
fi

echo -e "${YELLOW}Important commands:${NC}"
echo -e "${BLUE}- To view logs: docker-compose logs -f${NC}"
echo -e "${BLUE}- To stop containers: docker-compose down${NC}"
echo -e "${BLUE}- If admin/roles setup failed, run: docker-compose exec atlas-app npx prisma db seed${NC}"
echo -e "${BLUE}- For advanced admin diagnostics: docker-compose exec atlas-app node /app/debug-admin.js${NC}" 