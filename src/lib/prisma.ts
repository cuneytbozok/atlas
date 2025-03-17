import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

// Add prisma to the NodeJS global type
declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Create a new PrismaClient instance with custom error handling
 */
function createPrismaClient() {
  const client = new PrismaClient({
    log: ['error', 'warn'],
  });

  // Add error handling
  client.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (error) {
      console.error(`Prisma error in ${params.model}.${params.action}:`, error);
      throw error;
    }
  });

  return client;
}

// Check if we already have a client instance - if not, create one
const prismaGlobal = global as unknown as { prisma: PrismaClient };
export const prisma = prismaGlobal.prisma || createPrismaClient();

// Save the client to avoid multiple connections in development
if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.prisma = prisma;
}

// Ensure the client is initialized and connected
prisma.$connect()
  .then(() => {
    console.log('Connected to database successfully');
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error);
  }); 