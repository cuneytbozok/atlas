import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

// Prevent multiple instances of Prisma Client in development
declare global {
  var prisma: PrismaClient | any;
}

/**
 * Check if we should skip database connectivity checks
 * This is useful for environments like Docker build where no actual
 * database connection is needed during the build step.
 */
function shouldSkipDbChecks(): boolean {
  return (
    // Skip if explicitly requested during build
    (process.env.NEXT_PUBLIC_SKIP_DB_CHECKS === 'true' && 
     process.env.npm_lifecycle_event === 'build') ||
    (process.env.PRISMA_SKIP_DATABASE_CONNECT_CHECK === 'true' &&
     process.env.npm_lifecycle_event === 'build') ||
    // Skip for tests
    process.env.NODE_ENV === 'test'
  );
}

/**
 * Create a dummy Prisma client that doesn't connect to a database
 * Used during build time or tests where a real DB connection isn't needed
 */
function getDummyPrismaClient() {
  console.log('Using dummy Prisma client (skipping database connection)');
  return {
    $connect: async () => {},
    $disconnect: async () => {},
    $executeRawUnsafe: async () => {},
    $executeRaw: async () => {},
    $queryRaw: async () => [],
    $queryRawUnsafe: async () => [],
    $transaction: async (fn: any) => fn([]),
    // Add dummy implementations for common models
    user: {
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      count: async () => 0,
    },
    session: {
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      count: async () => 0,
    },
    role: {
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      create: async () => ({}),
    },
    permission: {
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      create: async () => ({}),
    },
  };
}

// If we should skip database checks (during build or testing), use a dummy client
// Otherwise, use a real PrismaClient instance
let prismaClient: PrismaClient | any;

if (shouldSkipDbChecks()) {
  prismaClient = getDummyPrismaClient();
} else {
  // Use a single instance of Prisma Client in development
  // In production, each function call gets a dedicated connection
  prismaClient = global.prisma || new PrismaClient();
  
  if (process.env.NODE_ENV !== 'production') {
    global.prisma = prismaClient;
  }

  // Ensure the client is initialized and connected
  prismaClient.$connect()
    .then(() => {
      console.log('Connected to database successfully');
    })
    .catch((error: Error) => {
      console.error('Failed to connect to database:', error);
    });
}

// Export both as default and named export for backward compatibility
const prisma = prismaClient;
export default prisma;
export { prisma }; 