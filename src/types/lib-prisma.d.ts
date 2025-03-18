// Type declarations for '@/lib/prisma' module
declare module '@/lib/prisma' {
  import { PrismaClient } from '@prisma/client';
  
  const prisma: PrismaClient;
  export { prisma };
  export default prisma;
} 