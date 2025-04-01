#!/bin/bash

# Function for formatted logging
log() {
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $1"
}

# Function to verify and fix the DATABASE_URL format
verify_database_url() {
  log "🔄 Verifying DATABASE_URL format..."
  
  if [ -z "$DATABASE_URL" ]; then
    log "⚠️ DATABASE_URL environment variable is not set!"
    return 1
  fi
  
  # Check if DATABASE_URL starts with the correct protocol
  if [[ ! "$DATABASE_URL" =~ ^postgresql:// && ! "$DATABASE_URL" =~ ^postgres:// ]]; then
    log "⚠️ DATABASE_URL doesn't have the correct protocol prefix!"
    
    # If DATABASE_URL has a format without protocol, attempt to fix it
    if [[ "$DATABASE_URL" =~ ^[^:]+:[^@]+@[^:]+:[0-9]+/[^?]+ ]]; then
      # Extract host, user, password, port and database name
      local db_parts=($(echo "$DATABASE_URL" | sed -E 's/([^:]+):([^@]+)@([^:]+):([0-9]+)\/([^?]+)(.*)/\1 \2 \3 \4 \5 \6/'))
      
      if [ ${#db_parts[@]} -ge 5 ]; then
        local db_user="${db_parts[0]}"
        local db_pass="${db_parts[1]}"
        local db_host="${db_parts[2]}"
        local db_port="${db_parts[3]}"
        local db_name="${db_parts[4]}"
        local db_params="${db_parts[5]}"
        
        # Construct correct URL
        export DATABASE_URL="postgresql://$db_user:$db_pass@$db_host:$db_port/$db_name$db_params"
        log "✅ Fixed DATABASE_URL to: $DATABASE_URL"
      else
        log "❌ Failed to parse and fix DATABASE_URL format"
        return 1
      fi
    else
      # If the format is completely different, prepend postgresql://
      export DATABASE_URL="postgresql://${DATABASE_URL#*://}"
      log "✅ Added postgresql:// prefix to DATABASE_URL"
    fi
  else
    log "✅ DATABASE_URL has the correct protocol format"
  fi
  
  return 0
}

# Function to check if we're running in production mode
is_production() {
  [[ "$NODE_ENV" == "production" ]]
}

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
  log "⏳ Waiting for PostgreSQL to be ready..."
  
  local db_host="${DB_HOST:-postgres}"
  local db_user="${POSTGRES_USER:-postgres}"
  local attempts=0
  local max_attempts=30
  
  # Check connectivity with extended parameters
  while ! pg_isready -h "$db_host" -U "$db_user" -d "${POSTGRES_DB:-atlas}"; do
    attempts=$((attempts + 1))
    if [ $attempts -ge $max_attempts ]; then
      log "❌ Failed to connect to PostgreSQL after $max_attempts attempts. Exiting."
      exit 1
    fi
    log "Attempt $attempts of $max_attempts: PostgreSQL not ready yet, waiting..."
    sleep 2
  done
  
  # If we can connect, wait a bit longer to make sure the server is fully initialized
  log "PostgreSQL is accepting connections. Waiting a moment for full initialization..."
  sleep 3
  
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
  
  log "✅ Database migrations completed successfully"
}

# Function to generate Prisma client
generate_prisma_client() {
  log "🔄 Generating Prisma client..."
  npx prisma generate
  log "✅ Prisma client generated successfully"
}

# Function to setup initial application data using seed
setup_application_data() {
  log "🔄 Setting up application data (roles, permissions, admin user)..."
  
  # Try to run Prisma seed command first
  if npx prisma db seed; then
    log "✅ Application data setup completed successfully using Prisma seed"
    return 0
  fi
  
  log "⚠️ Prisma seed command failed, falling back to direct database setup..."
  
  # Fall back to direct role creation using Node.js
  # Retry mechanism for database seeding
  local attempts=0
  local max_attempts=3
  local seed_success=false
  
  while [ $attempts -lt $max_attempts ] && [ "$seed_success" != "true" ]; do
    attempts=$((attempts + 1))
    
    if [ $attempts -gt 1 ]; then
      log "Retry attempt $attempts of $max_attempts for database setup..."
      sleep 2
    fi
    
    if node -e "
      const { PrismaClient } = require('@prisma/client');
      const bcrypt = require('bcryptjs');
      
      async function setupRolesAndAdmin() {
        const prisma = new PrismaClient();
        
        try {
          console.log('Setting up system roles, permissions, and admin user...');
          
          // First verify database connection
          console.log('Verifying database connection...');
          await prisma.\$queryRaw\`SELECT 1 as connection_test\`;
          console.log('Database connection confirmed');
          
          // Define the system roles with proper display names
          const systemRoles = [
            { name: 'ADMIN', description: 'Administrator with full access to all features' },
            { name: 'PROJECT_MANAGER', description: 'User who can manage projects' },
            { name: 'USER', description: 'Regular user with limited access' }
          ];
        
          console.log('Creating/updating system roles...');
          // Create or update system roles
          const createdRoles = {};
          for (const roleData of systemRoles) {
            const role = await prisma.role.upsert({
              where: { name: roleData.name },
              update: { description: roleData.description },
              create: roleData,
            });
            createdRoles[roleData.name] = role;
            console.log(\`✓ Role \${roleData.name} ensured with ID: \${role.id}\`);
          }
        
          console.log('✅ Roles created successfully');
          
          // Define all permissions
          const permissions = [
            // Critical permissions first for visibility in logs
            { name: 'MANAGE_APP_SETTINGS', description: 'Permission to manage application settings' },
            { name: 'VIEW_APP_SETTINGS', description: 'Permission to view application settings' },
            
            // Other permissions
            { name: 'CREATE_PROJECT', description: 'Permission to create new projects' },
            { name: 'MANAGE_USERS', description: 'Permission to manage users' },
            { name: 'USE_AI', description: 'Permission to use AI features' },
            { name: 'MANAGE_PROJECTS', description: 'Permission to manage existing projects' },
            { name: 'DELETE_PROJECTS', description: 'Permission to delete projects' },
          ];
        
          console.log('Creating/updating all permissions...');
          // Create all permissions
          const createdPermissions = {};
          for (const permission of permissions) {
            const created = await prisma.permission.upsert({
              where: { name: permission.name },
              update: { description: permission.description },
              create: permission,
            });
            createdPermissions[permission.name] = created;
            console.log(\`✓ Permission \${permission.name} ensured\`);
          }
        
          console.log('✅ Permissions created successfully');
        
          console.log('Assigning permissions to roles...');
          
          // Define role permission assignments - ADMIN gets ALL permissions
          for (const permission of Object.values(createdPermissions)) {
            await prisma.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: createdRoles['ADMIN'].id,
                  permissionId: permission.id,
                },
              },
              update: {},
              create: {
                roleId: createdRoles['ADMIN'].id,
                permissionId: permission.id,
              },
            });
            console.log(\`✓ Assigned \${permission.name} to ADMIN role\`);
          }
          
          // Project Manager role permissions
          const pmPermissions = ['CREATE_PROJECT', 'MANAGE_PROJECTS', 'USE_AI'];
          console.log('Assigning permissions to PROJECT_MANAGER role...');
          for (const permName of pmPermissions) {
            await prisma.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: createdRoles['PROJECT_MANAGER'].id,
                  permissionId: createdPermissions[permName].id,
                },
              },
              update: {},
              create: {
                roleId: createdRoles['PROJECT_MANAGER'].id,
                permissionId: createdPermissions[permName].id,
              },
            });
            console.log(\`✓ Assigned \${permName} to PROJECT_MANAGER role\`);
          }
          
          // User role permissions
          console.log('Assigning permissions to USER role...');
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: createdRoles['USER'].id,
                permissionId: createdPermissions['USE_AI'].id,
              },
            },
            update: {},
            create: {
              roleId: createdRoles['USER'].id,
              permissionId: createdPermissions['USE_AI'].id,
            },
          });
          console.log(\`✓ Assigned USE_AI to USER role\`);
        
          console.log('✅ Role permissions assigned successfully');
        
          // Create admin user with password 'password'
          const adminPassword = await bcrypt.hash('password', 12);
          
          const admin = await prisma.user.upsert({
            where: { email: 'admin@atlas.com' },
            update: {},
            create: {
              email: 'admin@atlas.com',
              name: 'Admin User',
              password: adminPassword,
            },
          });
          
          // Assign admin role to admin user
          await prisma.userRole.upsert({
            where: {
              userId_roleId: {
                userId: admin.id,
                roleId: createdRoles['ADMIN'].id,
              },
            },
            update: {},
            create: {
              userId: admin.id,
              roleId: createdRoles['ADMIN'].id,
            },
          });
          
          console.log('✅ Admin user created successfully and assigned ADMIN role');
          
          // Create default app settings
          console.log('Creating default app settings...');
          const defaultSettings = [
            { key: 'APP_NAME', value: 'ATLAS', description: 'Application name', isEncrypted: false },
            { key: 'APP_DESCRIPTION', value: 'Advanced Team Learning Assistant System', description: 'Application description', isEncrypted: false },
            { key: 'OPENAI_API_KEY', value: '', description: 'OpenAI API Key for AI functions', isEncrypted: true },
            { key: 'DEFAULT_AI_MODEL', value: 'gpt-4o', description: 'Default AI model to use', isEncrypted: false },
            { key: 'SYSTEM_INITIALIZED', value: 'true', description: 'Whether the system has been initialized', isEncrypted: false },
          ];
        
          for (const setting of defaultSettings) {
            await prisma.appSetting.upsert({
              where: { key: setting.key },
              update: { 
                value: setting.value, 
                description: setting.description, 
                isEncrypted: setting.isEncrypted 
              },
              create: {
                key: setting.key,
                value: setting.value,
                description: setting.description,
                isEncrypted: setting.isEncrypted
              },
            });
            console.log(\`✓ App setting \${setting.key} ensured\`);
          }
        
          console.log('✅ Default app settings created successfully');
          console.log('✅ Application setup completed successfully');
        } catch (error) {
          console.error('Error during database setup:', error);
          process.exit(1);
        } finally {
          await prisma.\$disconnect();
        }
      }
      
      setupRolesAndAdmin()
        .then(() => process.exit(0))
        .catch(error => {
          console.error('Unhandled error in setup:', error);
          process.exit(1);
        });
    "; then
      seed_success=true
      log "✅ Application data setup completed successfully using fallback method"
    else
      log "⚠️ Application data setup failed on attempt $attempts"
      if [ $attempts -ge $max_attempts ]; then
        log "❌ Failed to complete data setup after $max_attempts attempts."
        log "The application will continue, but roles and admin user may not be properly configured."
      fi
    fi
  done
}

# Function to setup password reset table - only if it doesn't exist already
setup_password_reset() {
  log "🔄 Setting up password reset functionality..."
  
  # Get the database connection string
  local db_url="${DATABASE_URL}"
  if [ -z "$db_url" ]; then
    log "⚠️ DATABASE_URL not set, skipping password reset setup"
    return
  fi
  
  # Extract connection parts without schema parameter
  DB_CONN=${db_url%%\?*}
  
  # Check if table already exists before trying to create it
  TABLE_EXISTS=$(psql "$DB_CONN" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'PasswordResetToken') AS table_exists;")
  
  if [[ "$TABLE_EXISTS" =~ [[:space:]]*t[[:space:]]*$ ]]; then
    log "✅ PasswordResetToken table exists!"
  else
    log "Creating PasswordResetToken table and indexes..."
    
    # Create the password reset table and indexes - using explicit error handling
    psql "$DB_CONN" -c "CREATE TABLE IF NOT EXISTS \"PasswordResetToken\" (\"id\" TEXT NOT NULL, \"token\" TEXT NOT NULL, \"userId\" TEXT NOT NULL, \"expiresAt\" TIMESTAMP(3) NOT NULL, \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT \"PasswordResetToken_pkey\" PRIMARY KEY (\"id\"));" || log "⚠️ Error creating PasswordResetToken table"
    psql "$DB_CONN" -c "CREATE UNIQUE INDEX IF NOT EXISTS \"PasswordResetToken_token_key\" ON \"PasswordResetToken\"(\"token\");" || log "⚠️ Error creating token unique index"
    psql "$DB_CONN" -c "CREATE INDEX IF NOT EXISTS \"PasswordResetToken_userId_idx\" ON \"PasswordResetToken\"(\"userId\");" || log "⚠️ Error creating userId index"
    psql "$DB_CONN" -c "CREATE INDEX IF NOT EXISTS \"PasswordResetToken_token_idx\" ON \"PasswordResetToken\"(\"token\");" || log "⚠️ Error creating token index"
    
    # Check if constraint already exists before adding it - safer approach
    CONSTRAINT_EXISTS=$(psql "$DB_CONN" -t -c "SELECT COUNT(*) FROM pg_constraint WHERE conname = 'PasswordResetToken_userId_fkey';")
    if [[ "$CONSTRAINT_EXISTS" =~ ^[[:space:]]*0[[:space:]]*$ ]]; then
      log "Adding foreign key constraint..."
      psql "$DB_CONN" -c "ALTER TABLE \"PasswordResetToken\" ADD CONSTRAINT \"PasswordResetToken_userId_fkey\" FOREIGN KEY (\"userId\") REFERENCES \"User\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;" || log "⚠️ Error adding foreign key constraint"
    fi
    
    # Verify table was created
    TABLE_EXISTS=$(psql "$DB_CONN" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'PasswordResetToken') AS table_exists;")
    
    if [[ "$TABLE_EXISTS" =~ [[:space:]]*t[[:space:]]*$ ]]; then
      log "✅ PasswordResetToken table created successfully!"
    else
      log "⚠️ Failed to verify PasswordResetToken table creation"
    fi
  fi
}

# Main function
main() {
  log "🚀 Initializing ATLAS application..."
  
  # Verify DATABASE_URL format
  verify_database_url
  
  # Wait for PostgreSQL to be ready - this is critical
  wait_for_postgres
  
  # Generate Prisma client
  generate_prisma_client
  
  # Run database migrations
  run_migrations
  
  # Add a short pause to ensure migrations are fully applied
  log "Waiting for migrations to settle..."
  sleep 5
  
  # Setup password reset functionality 
  setup_password_reset
  
  # Verify database connectivity explicitly
  log "🔄 Verifying database connectivity before application setup..."
  if ! psql "${DATABASE_URL}" -c "SELECT 1 as connection_test" > /dev/null 2>&1; then
    log "⚠️ Database connectivity check failed, but continuing..."
    sleep 3
  else
    log "✅ Database connectivity confirmed"
  fi
  
  # Setup application data using seed (roles, permissions, admin user)
  setup_application_data
  
  log "✅ Initialization complete, starting application..."
  if ! is_production; then
    log "👤 Admin credentials: email=admin@atlas.com, password=password"
    log "⚠️ IMPORTANT: Please change the admin password after first login for security reasons!"
  fi
  
  # Start the application
  exec "$@"
}

# Run the main function with all arguments passed to the script
main "$@" 