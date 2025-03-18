#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL to be ready..."
# Maximum number of attempts
max_attempts=30
# Counter for attempts
attempt_num=0

# Try to connect to PostgreSQL
until npx prisma migrate deploy || [ $attempt_num -eq $max_attempts ]; do
  echo "🔄 Waiting for PostgreSQL to be ready... ($((attempt_num+1))/$max_attempts)"
  attempt_num=$((attempt_num+1))
  sleep 2
done

if [ $attempt_num -eq $max_attempts ]; then
  echo "❌ Failed to connect to PostgreSQL after $max_attempts attempts"
  exit 1
fi

echo "✅ PostgreSQL is ready!"

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "🔄 Checking database schema..."
npx prisma generate

echo "🌱 Seeding database..."
npx prisma db seed

echo "🔄 Verifying roles and permissions..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyRoles() {
  try {
    // Check if roles exist
    const roleCount = await prisma.role.count();
    if (roleCount === 0) {
      console.log('Creating default roles...');
      // Create default roles if none exist
      await prisma.role.createMany({
        data: [
          { name: 'ADMIN', description: 'Administrator with full access' },
          { name: 'USER', description: 'Regular user with limited access' },
          { name: 'PROJECT_MANAGER', description: 'Manager with project access' }
        ],
        skipDuplicates: true
      });
    } else {
      console.log('Roles verified: ✅');
    }
    
    // Ensure at least one admin user exists
    const adminUserCount = await prisma.userRole.count({
      where: {
        role: {
          name: 'ADMIN'
        }
      }
    });
    
    if (adminUserCount === 0) {
      console.log('No admin user found, creating default admin...');
      
      // Create a default admin user if none exists
      const defaultAdmin = await prisma.user.upsert({
        where: { email: 'admin@atlas-ai.com' },
        update: {},
        create: {
          email: 'admin@atlas-ai.com',
          name: 'Admin User',
          password: '$2a$10$ZOFEYRZb7m.3CbmQypvA.OIhJp3S7lXwELHqEqA6xjqGMXl.3/Ngy' // 'password'
        }
      });
      
      // Assign admin role to the user
      await prisma.userRole.create({
        data: {
          userId: defaultAdmin.id,
          roleId: (await prisma.role.findUnique({ where: { name: 'ADMIN' } })).id
        }
      });
      
      console.log('Default admin user created ✅');
    } else {
      console.log('Admin user verified: ✅');
    }
  } catch (error) {
    console.error('Error verifying roles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyRoles();
"

echo "🚀 Starting ATLAS application..."
exec "$@" 