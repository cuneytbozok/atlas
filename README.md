# ATLAS - Advanced Team Learning Assistant System

This is a Next.js application that provides an AI-powered workspace for enhanced team learning and productivity.

## Getting Started

### Local Development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Docker Deployment

ATLAS can be easily deployed using Docker:

```bash
# Build and start the containers
docker-compose up -d
```

The system will automatically:
- Start the PostgreSQL database
- Run database migrations & seed data
- Start the ATLAS application

```bash
# View logs
docker-compose logs -f
```

For detailed Docker deployment instructions, see [DOCKER.md](./DOCKER.md).

## Features

- AI-powered document analysis and insights
- Collaborative workspaces for teams
- Intelligent knowledge management
- Context-aware AI assistance
- Seamless project organization

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Database

ATLAS uses PostgreSQL for data storage. See [DATABASE.md](./DATABASE.md) for details on the schema.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
