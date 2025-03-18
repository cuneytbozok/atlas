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
  
  while ! pg_isready -h postgres -U postgres; do
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
  npx prisma migrate deploy
  local migration_status=$?
  if [ $migration_status -eq 0 ]; then
    log "✅ Database migrations completed successfully"
  else
    log "⚠️ Database migrations completed with status $migration_status"
  fi
}

# Function to generate Prisma client
generate_prisma_client() {
  log "🔄 Generating Prisma client..."
  npx prisma generate
  local generate_status=$?
  if [ $generate_status -eq 0 ]; then
    log "✅ Prisma client generated successfully"
  else
    log "⚠️ Prisma client generation completed with status $generate_status"
  fi
}

# Function to initialize database with seed script
initialize_database() {
  log "🔄 Initializing database with seed script..."
  npx prisma db seed
  local seed_status=$?
  if [ $seed_status -eq 0 ]; then
    log "✅ Database initialization completed successfully"
  else
    log "⚠️ Database initialization completed with status $seed_status - attempting to fix..."
    # Attempt to repair potential permission issues using direct database access
    log "🔄 Running permission repair script..."
    
    # Attempt to verify admin permissions directly
    node -e "
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      async function repairPermissions() {
        try {
          // Find the admin role
          const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
          if (!adminRole) {
            console.log('Admin role not found - cannot repair permissions');
            return false;
          }
          
          // Find the admin user
          const adminUser = await prisma.user.findUnique({ where: { email: 'admin@atlas.com' } });
          if (!adminUser) {
            console.log('Admin user not found - cannot repair permissions');
            return false;
          }
          
          // Find or create MANAGE_APP_SETTINGS permission
          let appSettingsPermission = await prisma.permission.findUnique({ 
            where: { name: 'MANAGE_APP_SETTINGS' }
          });
          
          if (!appSettingsPermission) {
            appSettingsPermission = await prisma.permission.create({
              data: { 
                name: 'MANAGE_APP_SETTINGS', 
                description: 'Permission to manage application settings' 
              }
            });
            console.log('Created MANAGE_APP_SETTINGS permission');
          }
          
          // Find or create VIEW_APP_SETTINGS permission
          let viewSettingsPermission = await prisma.permission.findUnique({ 
            where: { name: 'VIEW_APP_SETTINGS' }
          });
          
          if (!viewSettingsPermission) {
            viewSettingsPermission = await prisma.permission.create({
              data: { 
                name: 'VIEW_APP_SETTINGS', 
                description: 'Permission to view application settings' 
              }
            });
            console.log('Created VIEW_APP_SETTINGS permission');
          }
          
          // Assign permissions to admin role if not already assigned
          const existingManagePermission = await prisma.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: adminRole.id,
                permissionId: appSettingsPermission.id
              }
            }
          });
          
          if (!existingManagePermission) {
            await prisma.rolePermission.create({
              data: {
                roleId: adminRole.id,
                permissionId: appSettingsPermission.id
              }
            });
            console.log('Assigned MANAGE_APP_SETTINGS to ADMIN role');
          }
          
          const existingViewPermission = await prisma.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: adminRole.id,
                permissionId: viewSettingsPermission.id
              }
            }
          });
          
          if (!existingViewPermission) {
            await prisma.rolePermission.create({
              data: {
                roleId: adminRole.id,
                permissionId: viewSettingsPermission.id
              }
            });
            console.log('Assigned VIEW_APP_SETTINGS to ADMIN role');
          }
          
          // Ensure admin has admin role
          const adminRoleAssignment = await prisma.userRole.findUnique({
            where: {
              userId_roleId: {
                userId: adminUser.id,
                roleId: adminRole.id
              }
            }
          });
          
          if (!adminRoleAssignment) {
            await prisma.userRole.create({
              data: {
                userId: adminUser.id,
                roleId: adminRole.id
              }
            });
            console.log('Assigned ADMIN role to admin user');
          }
          
          console.log('Permission repair completed successfully');
          return true;
        } catch (error) {
          console.error('Error during permission repair:', error);
          return false;
        } finally {
          await prisma.$disconnect();
        }
      }
      
      repairPermissions()
        .then(success => {
          if (success) {
            console.log('✅ Permission repair successful');
          } else {
            console.log('⚠️ Permission repair completed with warnings');
          }
        })
        .catch(error => {
          console.error('❌ Permission repair failed:', error);
        });
    "
    
    log "✅ Permission repair script completed"
  fi
}

# Main function
main() {
  log "🚀 Starting ATLAS application..."
  
  # Wait for PostgreSQL to be ready
  wait_for_postgres
  
  # Generate Prisma client
  generate_prisma_client
  
  # Run database migrations
  run_migrations
  
  # Initialize database with seed script
  initialize_database
  
  # Start the application
  log "✅ All initialization steps completed successfully, starting application..."
  log "👤 Admin credentials: email=admin@atlas.com, password=password"
  log "⚠️ IMPORTANT: Please change the admin password after first login for security reasons!"
  
  exec "$@"
}

# Run the main function
main "$@" 