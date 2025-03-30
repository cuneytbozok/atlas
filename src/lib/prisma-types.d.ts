import { PrismaClient } from '@prisma/client';

declare global {
  // Add PasswordResetToken to Prisma Client
  namespace PrismaClient {
    interface PrismaClient {
      passwordResetToken: {
        create: (args: any) => Promise<any>;
        delete: (args: any) => Promise<any>;
        deleteMany: (args: any) => Promise<any>;
        findMany: (args: any) => Promise<any[]>;
        findUnique: (args: any) => Promise<any | null>;
      };
    }
  }
} 