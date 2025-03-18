import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

// Prevent multiple instances of Prisma Client in development
declare global {
  var prisma: PrismaClient | undefined;
}

// Use a single instance of Prisma Client in development
// In production, each function call gets a dedicated connection
const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Export both as default and named export for backward compatibility
export default prisma;
export { prisma };

// Ensure the client is initialized and connected
prisma.$connect()
  .then(() => {
    console.log('Connected to database successfully');
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error);
  }); 