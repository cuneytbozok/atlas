# Deploying ATLAS with Docker

This guide explains how to deploy the ATLAS application using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- An OpenAI API key (required for AI functionality)

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/atlas.git
   cd atlas/atlas-app
   ```

2. Create a `.env` file for your environment variables:
   ```bash
   cp .env.example .env
   ```

3. Edit the `.env` file to add your OpenAI API key and modify any other settings:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Run the application with Docker Compose:
   ```bash
   docker-compose up -d
   ```

5. Access ATLAS at http://localhost:3000

## Environment Variables

The following environment variables can be configured:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@postgres:5432/atlas?schema=public` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-jwt-key-change-in-production` |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` |
| `NEXTAUTH_SECRET` | Secret key for NextAuth | `your-nextauth-secret-key-change-in-production` |
| `NEXTAUTH_URL` | URL for NextAuth | `http://localhost:3000` |
| `OPENAI_API_KEY` | Your OpenAI API key | `required` |

## Persisting Data

PostgreSQL data is persisted in a Docker volume named `postgres-data`. This ensures your data remains intact even if the container is removed.

## Production Deployment

For production deployments, consider:

1. Using a reverse proxy like Nginx for SSL termination
2. Setting stronger passwords in the environment variables
3. Using a managed PostgreSQL service instead of the container

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Updating ATLAS

To update to a new version:

1. Pull the latest code:
   ```bash
   git pull
   ```

2. Rebuild and restart the containers:
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Troubleshooting

### Database Connection Issues

If the application can't connect to the database, check:

1. The PostgreSQL container is running:
   ```bash
   docker ps | grep postgres
   ```

2. The DATABASE_URL environment variable is set correctly in your `.env` file.

### OpenAI API Issues

If AI features aren't working:

1. Verify your OPENAI_API_KEY is set correctly
2. Check if your OpenAI API key has the necessary permissions
3. Check the application logs:
   ```bash
   docker-compose logs -f atlas
   ```

## Security Notes

1. **Change default secrets**: Always change the default JWT and NextAuth secrets in production
2. **API Key security**: Your OpenAI API key should be kept confidential
3. **Database passwords**: Change the default PostgreSQL password in production

## Accessing from Other Devices

To access ATLAS from other devices on your network:

1. Use your server's IP address: `http://your-server-ip:3000`
2. For public access, set up a domain and proper SSL certificate 