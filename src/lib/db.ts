import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Helper functions for common database operations

/**
 * Safely executes a database operation with error handling
 * @param operation - The database operation to execute
 * @returns The result of the operation or throws an error
 */
export async function executeDbOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  }
}

/**
 * Executes a database transaction
 * @param operations - The operations to execute in a transaction
 * @returns The result of the transaction
 */
export async function executeTransaction<T>(
  operations: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx: any) => {
    try {
      return await operations(tx as unknown as PrismaClient);
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  });
}

/**
 * Checks if the database connection is healthy
 * @returns True if the connection is healthy, false otherwise
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
} 