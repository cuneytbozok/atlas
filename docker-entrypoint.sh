#!/bin/bash

# Function for formatted logging
log() {
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $1"
}

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
  log "⏳ Waiting for PostgreSQL to be ready..."
  
  local attempts=0
  local max_attempts=30
  
  while ! npx prisma migrate dev --skip-seed --skip-generate; do
    attempts=$((attempts + 1))
    if [ $attempts -ge $max_attempts ]; then
      log "❌ Failed to connect to PostgreSQL after $max_attempts attempts. Exiting."
      exit 1
    fi
    log "Attempt $attempts of $max_attempts: PostgreSQL not ready yet, waiting..."
    sleep 2
  done
  
  log "✅ PostgreSQL is ready!"
}

# Function to run database migrations
run_migrations() {
  log "🔄 Running database migrations..."
  
  local attempts=0
  local max_attempts=3
  
  while ! npx prisma migrate deploy; do
    attempts=$((attempts + 1))
    if [ $attempts -ge $max_attempts ]; then
      log "❌ Failed to run migrations after $max_attempts attempts. Exiting."
      exit 1
    fi
    log "Attempt $attempts of $max_attempts: Migration failed, retrying..."
    sleep 2
  done
}

# Function to generate Prisma client
generate_prisma_client() {
  log "🔄 Checking database schema..."
  npx prisma generate
}

# Function to verify roles and permissions (only create admin)
verify_roles_and_permissions() {
  log "🔄 Verifying admin role and user..."
  
  # Use Prisma's node client to check and create admin
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const prisma = new PrismaClient();
    
    async function verifyAdmin() {
      try {
        // Check for ADMIN role
        const adminRole = await prisma.role.findFirst({ 
          where: { name: 'ADMIN' } 
        });
        
        if (!adminRole) {
          console.log('Creating ADMIN role...');
          await prisma.role.create({
            data: {
              name: 'ADMIN',
              description: 'Administrator with full access to all features'
            }
          });
        }
        
        // Check for admin user
        const adminUser = await prisma.user.findFirst({
          where: { email: 'admin@atlas.com' }
        });
        
        if (!adminUser) {
          console.log('Creating admin user...');
          const hashedPassword = await bcrypt.hash('password', 12);
          
          // Create admin user
          const user = await prisma.user.create({
            data: {
              name: 'Admin User',
              email: 'admin@atlas.com',
              password: hashedPassword
            }
          });
          
          // Connect admin role to user
          await prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: (await prisma.role.findFirst({ where: { name: 'ADMIN' } })).id
            }
          });
          
          console.log('Admin user created successfully');
        } else {
          console.log('Admin user already exists');
        }
      } catch (error) {
        console.error('Error verifying admin:', error);
      } finally {
        await prisma.$disconnect();
      }
    }
    
    verifyAdmin();
  "
}

# Skip the default database seeding
skip_default_seeding() {
  log "🌱 Skipping default database seeding..."
  
  # Create an empty seed command that does nothing
  # This prevents the default seed from running
  echo "console.log('Skipping default seed');" > /app/prisma/seed.ts.skip
  
  # Temporarily replace the original seed
  if [ -f /app/prisma/seed.ts ]; then
    mv /app/prisma/seed.ts /app/prisma/seed.ts.original
    mv /app/prisma/seed.ts.skip /app/prisma/seed.ts
  fi
}

# Restore the original seed file if it was replaced
restore_original_seed() {
  if [ -f /app/prisma/seed.ts.original ]; then
    mv /app/prisma/seed.ts.original /app/prisma/seed.ts
    log "✅ Restored original seed file"
  fi
}

# Main function to run the initialization process
main() {
  log "🚀 Initializing ATLAS application..."
  
  # Skip default seeding that creates multiple users
  skip_default_seeding
  
  wait_for_postgres
  run_migrations
  generate_prisma_client
  verify_roles_and_permissions
  
  # Restore the original seed file for future use
  restore_original_seed
  
  # Initialize the password reset table
  log "Setting up password reset functionality..."
  bash ./setup-password-reset.sh
  
  log "✅ Initialization complete, starting application..."
  
  # Start the application
  exec "$@"
}

# Run the main function with all arguments passed to the script
main "$@" 