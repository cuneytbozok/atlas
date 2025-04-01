# ATLAS Docker Setup Guide

This guide explains how to set up and run the ATLAS application using Docker in both production and development environments.

## Quick Start

### Production Setup

1. Create a `.env` file in the root directory with your production environment variables
2. Run the containers:

```bash
docker-compose up -d
```

### Development Setup

1. Create a `.env` file or use the default `.env.docker`
2. Run the development containers:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Environment Variables

### Required Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `JWT_SECRET`: Secret key for JWT token generation (change from default in production)
- `NEXTAUTH_SECRET`: Secret key for NextAuth authentication (change from default in production)

### Optional Variables

- `POSTGRES_USER`: PostgreSQL username (default: postgres)
- `POSTGRES_PASSWORD`: PostgreSQL password (default: postgres)
- `POSTGRES_DB`: PostgreSQL database name (default: atlas)
- `PORT`: Port to expose the application (default: 3000)
- `NODE_ENV`: Environment mode (default: production)
- `DOCKERFILE`: Docker file to use (default: Dockerfile)

## Docker Compose Configuration

The project includes two Docker Compose configurations:

1. `docker-compose.yml` - For production environment
2. `docker-compose.dev.yml` - For development environment

### Production vs Development

The main differences between production and development configurations:

**Production:**
- Uses optimized build with standalone Next.js output
- Doesn't mount source code as volumes
- Uses named volumes for data persistence
- Has longer health check intervals
- Doesn't expose database ports by default (configure as needed)

**Development:**
- Mounts source code for hot reloading
- Uses development-specific network and volumes
- Has shorter health check intervals
- Enables more verbose logging

## Database Migrations

The application automatically:

1. Waits for the PostgreSQL database to be ready
2. Generates the Prisma client
3. Runs database migrations
4. Sets up password reset functionality
5. Verifies the admin role and user

## Cleaning Up

### Development Environment

To remove development containers and volumes:

```bash
docker-compose -f docker-compose.dev.yml down -v
```

### Production Environment

To remove production containers (preserving volumes):

```bash
docker-compose down
```

To remove production containers and volumes (will delete all data):

```bash
docker-compose down -v
```

## Backup and Restore

### Database Backup

To backup the PostgreSQL database:

```bash
docker exec atlas-postgres pg_dump -U postgres atlas > atlas_backup.sql
```

### Database Restore

To restore the PostgreSQL database from a backup:

```bash
cat atlas_backup.sql | docker exec -i atlas-postgres psql -U postgres -d atlas
```

## Troubleshooting

### Container Logs

To check container logs:

```bash
# Application logs
docker logs atlas-app

# Database logs
docker logs atlas-postgres
```

### Database Connection Issues

If the application can't connect to the database:

1. Check if the PostgreSQL container is running: `docker ps`
2. Verify the database credentials in the environment variables
3. Check network connectivity between containers

### Prisma Migration Issues

If Prisma migrations fail:

1. Check the logs for specific error messages
2. Manual migration: `docker exec -it atlas-app npx prisma migrate deploy`

## Security Considerations

For production deployments:

1. Change all default passwords and secrets
2. Use a reverse proxy (like Nginx) for SSL termination
3. Consider using Docker secrets for sensitive information
4. Restrict access to the database container
5. Enable regular database backups 