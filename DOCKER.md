# ATLAS Docker Setup Guide

This guide explains how to deploy and manage the ATLAS application using Docker.

## Prerequisites

- Docker and Docker Compose installed on your machine
- Git to clone the repository

## Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd atlas-app
```

### 2. Configure the environment

The application comes with a pre-configured `.env.docker` file for Docker deployment. You don't need to modify it for a basic setup, but you can adjust settings if needed.

### 3. Build and start the containers

Use the provided script:

```bash
./run-docker.sh
```

This script will:
- Build the Docker images if they don't exist
- Start the containers in detached mode

For a clean rebuild (recommended for first-time setup or after major changes):

```bash
./rebuild-docker.sh --clean
```

This will:
- Stop and remove any existing containers
- Rebuild the Docker images without using cache
- Start the containers in detached mode
- **Warning**: This will delete all data in the database

### 4. Access the application

Once the containers are running, access the application at:

```
http://localhost:3000
```

### 5. Log in with admin credentials

The application is pre-configured with an admin user:
- Email: `admin@atlas.com`
- Password: `password`

**IMPORTANT: For security, change this password immediately after your first login.**

## Helper Scripts

Several scripts are provided to manage the Docker environment:

### Rebuild and restart all containers

```bash
./rebuild-docker.sh
```

### Check container status and health

```bash
./status-docker.sh
```

### Stop all containers

```bash
./stop-docker.sh
```

## Docker Compose Services

The setup includes the following services:

1. **atlas-postgres**: PostgreSQL database server
   - Port: 5432 (mapped to host)
   - Credentials: postgres/postgres
   - Database: atlas

2. **atlas-app**: The ATLAS Next.js application
   - Port: 3000 (mapped to host)
   - Environment: Development mode

## Configuration

### Database Configuration

The PostgreSQL database is automatically initialized with:
- Default database: atlas
- UUID extension enabled
- Required privileges granted to the postgres user

### Application Initialization

During the first startup, ATLAS automatically:
1. Applies all database migrations
2. Creates the required roles (ADMIN, PROJECT_MANAGER, USER)
3. Sets up necessary permissions for each role
4. Creates the admin user with full permissions
5. Initializes default application settings

### Environment Variables

Key environment variables:

- `DATABASE_URL`: Connection string for PostgreSQL
- `OPENAI_API_KEY`: Initially set to a placeholder, configure in app
- `JWT_SECRET` and `NEXTAUTH_SECRET`: Authentication secrets
- `NODE_ENV`: Set to "development" by default

## Health Check API

ATLAS includes a built-in health check API endpoint at `/api/health` that Docker uses to determine container health. You can also use this endpoint for monitoring purposes.

Example response when healthy:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2023-09-14T12:34:56.789Z",
  "environment": "development"
}
```

You can manually check the health status with:
```bash
curl http://localhost:3000/api/health
```

This endpoint is configured in the Docker Compose and Dockerfile health checks to automatically monitor the application's status.

## User Management

### Pre-configured Roles

The application comes with three pre-configured roles:

1. **ADMIN**: Full access to all features, including:
   - Manage app settings
   - Create and manage projects
   - Manage users and permissions
   - Use AI features

2. **PROJECT_MANAGER**: Can create and manage projects
   - Create new projects
   - Manage existing projects
   - Use AI features

3. **USER**: Regular user with limited access
   - Use AI features
   - Participate in projects they've been invited to

### Creating Additional Users

You can create additional users through the admin interface after logging in:
1. Navigate to User Management
2. Click "Create User"
3. Assign appropriate roles

## Troubleshooting

### Container continuously restarting

Check the logs:

```bash
docker-compose logs atlas-app
```

Common issues:
- Database connection problems
- Prisma client not generated properly
- Environment variable issues

### Database connection issues

Verify PostgreSQL is running:

```bash
docker exec -it atlas-postgres pg_isready -U postgres
```

If the application reports "AppSetting table is not accessible" or similar errors:

```bash
# Restart the application container
docker-compose restart atlas

# If the issue persists, run the database seed manually
docker exec -it atlas-app npx prisma db seed
```

### Missing environment variables

Check if all required environment variables are in `.env.docker`.

## Development Workflow

### Making code changes

1. Make changes to your code
2. The development server will automatically restart
3. If you modify dependencies:
   ```bash
   ./rebuild-docker.sh
   ```

### Database migrations

When you modify the Prisma schema:

1. Generate and apply migrations:
   ```bash
   docker exec -it atlas-app npx prisma migrate dev --name your-migration-name
   ```

## Production Deployment

For production deployment:

1. Modify `.env.docker` with production settings
2. Use a secure `JWT_SECRET` and `NEXTAUTH_SECRET`
3. Configure a valid `OPENAI_API_KEY`
4. Change `NODE_ENV=production`
5. Rebuild the containers

## Security Notes

- Change all default passwords in production
- Configure SSL/TLS for production deployment
- Set up a reverse proxy (Nginx, Traefik) for production
- Don't expose PostgreSQL port in production

## Troubleshooting TypeScript Errors

When developing, you might encounter TypeScript errors related to missing imports or module declarations. These are typically resolved by:

1. Ensuring the TypeScript server is aware of your changes (restart VS Code or run `npx tsc --noEmit`)
2. Checking that paths in `tsconfig.json` are correctly configured
3. Making sure all required packages are installed

For a comprehensive guide to resolving TypeScript errors, see the [TYPESCRIPT.md](./TYPESCRIPT.md) file.

The Docker build process is configured to ignore TypeScript errors during build, but it's good practice to fix them in your development environment. 