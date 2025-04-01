FROM node:21-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files first
COPY package.json package-lock.json ./

# Create the dependency installation script directly in the container
RUN echo '#!/bin/sh' > install-dependencies.sh && \
    echo 'echo "Installing dependencies with legacy peer deps..."' >> install-dependencies.sh && \
    echo 'npm install --legacy-peer-deps "$@"' >> install-dependencies.sh && \
    echo 'echo "Dependencies installed successfully!"' >> install-dependencies.sh && \
    chmod +x install-dependencies.sh && \
    ls -la && \
    ./install-dependencies.sh

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy .env.docker to .env for build
COPY .env.docker .env

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line if you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

# Disable ESLint during build
ENV NEXT_DISABLE_ESLINT 1

# Skip database checks during build
ENV NEXT_PUBLIC_SKIP_DB_CHECKS true
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/atlas?schema=public"
ENV NEXT_PUBLIC_SKIP_AUTH_CHECK true
ENV PRISMA_SKIP_DATABASE_CONNECT_CHECK true

# Add placeholder API keys for build
ENV RESEND_API_KEY="re_placeholder_for_build_only"
ENV EMAIL_FROM="noreply@example.com"
ENV EMAIL_REPLY_TO="support@example.com"

# Build the application with type and lint checking disabled
RUN NEXT_PUBLIC_SKIP_AUTH_CHECK=true PRISMA_SKIP_DATABASE_CONNECT_CHECK=true NEXT_PUBLIC_SKIP_DB_CHECKS=true npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Add bash and other dependencies needed for the entrypoint script
RUN apk add --no-cache bash curl postgresql-client

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files for Prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create the installation script for production
RUN echo '#!/bin/sh' > install-dependencies.sh && \
    echo 'echo "Installing dependencies with legacy peer deps..."' >> install-dependencies.sh && \
    echo 'npm install --legacy-peer-deps "$@"' >> install-dependencies.sh && \
    echo 'echo "Dependencies installed successfully!"' >> install-dependencies.sh && \
    chmod +x install-dependencies.sh && \
    ./install-dependencies.sh --only=production

# Copy the public directory
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy consolidated entrypoint script
COPY --chmod=755 entrypoint.sh ./entrypoint.sh

# Set database host environment variable for the entrypoint script
ENV DB_HOST postgres

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Use our consolidated entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]

# The command to run (passed to entrypoint)
CMD ["node", "server.js"] 