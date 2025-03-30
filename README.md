# ATLAS - Advanced Team Learning Assistant System

This is a Next.js application that provides an AI-powered workspace for enhanced team learning and productivity.

![ATLAS Banner](docs/images/atlas-logo.png)

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

### Docker Deployment (Recommended)

The easiest way to deploy ATLAS is using Docker:

1. Make sure Docker and Docker Compose are installed
2. Run the automated setup script:
   ```bash
   ./rebuild-docker.sh
   ```
3. Access the application at http://localhost:3000

For detailed Docker deployment instructions, see [DOCKER.md](DOCKER.md).

## Features

- AI-powered document analysis and insights
- Context-aware AI assistance
- Custom assistant for each project
- Dark Mode
- User role management
- OPENAI API integration
- Prisma ORM
- NextJS App Router
- Docker containerization
- PostgreSQL database
- NextAuth authentication
- Tailwind CSS
- Shadcn UI

## Screenshots

### Dashboard
![Dashboard](docs/images/dashboard.png)
*The main dashboard provides an overview of your projects and recent activities.*

### Project View
![Project View](docs/images/project-view.png)
*Detailed project view with AI-assisted features and team collaboration tools.*

### Assistants Management
![Assistants Management](docs/images/assistant-management.png)
*Create and manage multiple AI-assisted projects with custom assistant features.*

### AI Chat Interface
![AI Chat](docs/images/ai-chat.png)
*The AI assistant provides context-aware responses based on your project data.*

### Document Analysis
![Document Analysis](docs/images/document-management.png)
*Upload and analyze documents with AI-powered insights.*

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Database

ATLAS uses PostgreSQL for data storage. See [DATABASE.md](./DATABASE.md) for details on the schema.

## Enabling Token Usage Tracking

Token usage tracking is enabled by default for new installations. If you're upgrading from an earlier version that doesn't have token tracking fields, you can add them by running:

```bash
# If using Docker:
./run_token_fields_sql.sh

# Or manually using psql:
psql -U your_username -d your_database_name -a -f add_token_usage_fields.sql

# Or using the prisma db execute command:
npx prisma db execute --file add_token_usage_fields.sql
```

Once the fields are added, Atlas will automatically start tracking token usage for all messages. You can view token usage statistics in the Insights page under the "Token Usage" tab.

## Password Reset System

The Atlas application includes a secure, production-ready password reset system. Key features include:

- **Secure Token Generation**: Using cryptographically secure random tokens
- **Time-Limited Tokens**: Reset tokens expire after 1 hour
- **Database Persistence**: Tokens are stored in the `PasswordResetToken` table
- **Professional Email Templates**: Beautiful, responsive email templates
- **Production Email Handling**: Integration with Resend for reliable email delivery
- **Security Best Practices**:
  - No email enumeration (same response regardless of email existence)
  - Strong password validation
  - Single-use tokens (consumed after use)
  - bcrypt password hashing with appropriate complexity

### Setup

The password reset system is automatically set up when the application starts via:

1. The `setup-password-reset.sh` script creates the necessary database structure
2. Docker entrypoint scripts ensure the system is ready in all environments
3. Integration with Resend for email delivery (configure via `RESEND_API_KEY` in `.env`)

### Configuration

Configure the following environment variables:

```env
# Required for email sending
RESEND_API_KEY=re_xxxxxxxxxxxx

# Email configuration (customize as needed)
EMAIL_FROM=onboarding@resend.dev
EMAIL_REPLY_TO=your@email.com

# App URL (for reset links)
NEXTAUTH_URL=https://your-app-url.com
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
