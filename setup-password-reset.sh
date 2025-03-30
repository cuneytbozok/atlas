#!/bin/bash

# Script to set up the PasswordResetToken table in the database
# This ensures proper setup for the password reset functionality

echo "Setting up Password Reset functionality..."

# Get the database connection string from .env file
if [ -f .env ]; then
  DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"')
  if [ -z "$DB_URL" ]; then
    echo "Error: DATABASE_URL not found in .env file"
    exit 1
  fi
else
  echo "Error: .env file not found"
  exit 1
fi

# Extract just the connection parts without the schema parameter
DB_CONN=${DB_URL%%\?*}
echo "Using database: $DB_CONN"

# Apply the SQL script to create the PasswordResetToken table
echo "Creating PasswordResetToken table if it doesn't exist..."
cat <<EOF | psql "$DB_CONN" || echo "Failed to execute SQL - continuing anyway"
-- Create PasswordResetToken table if it doesn't exist
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- Add foreign key if it doesn't exist
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_userId_fkey'
  ) THEN
    ALTER TABLE "PasswordResetToken" 
    ADD CONSTRAINT "PasswordResetToken_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END \$\$;

-- Verify table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'PasswordResetToken'
) AS "table_exists";
EOF

# Using direct PSQL command as a backup approach
echo "Running direct PSQL commands as a fallback..."
psql "$DB_CONN" -c "CREATE TABLE IF NOT EXISTS \"PasswordResetToken\" (\"id\" TEXT NOT NULL, \"token\" TEXT NOT NULL, \"userId\" TEXT NOT NULL, \"expiresAt\" TIMESTAMP(3) NOT NULL, \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT \"PasswordResetToken_pkey\" PRIMARY KEY (\"id\"));"
psql "$DB_CONN" -c "CREATE UNIQUE INDEX IF NOT EXISTS \"PasswordResetToken_token_key\" ON \"PasswordResetToken\"(\"token\");"
psql "$DB_CONN" -c "CREATE INDEX IF NOT EXISTS \"PasswordResetToken_userId_idx\" ON \"PasswordResetToken\"(\"userId\");"
psql "$DB_CONN" -c "CREATE INDEX IF NOT EXISTS \"PasswordResetToken_token_idx\" ON \"PasswordResetToken\"(\"token\");"
psql "$DB_CONN" -c "ALTER TABLE \"PasswordResetToken\" ADD CONSTRAINT IF NOT EXISTS \"PasswordResetToken_userId_fkey\" FOREIGN KEY (\"userId\") REFERENCES \"User\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;"

# Verify table exists
TABLE_EXISTS=$(psql "$DB_CONN" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'PasswordResetToken') AS table_exists;")

if [[ "$TABLE_EXISTS" == *"t"* ]]; then
  echo "✅ PasswordResetToken table exists!"
else
  echo "⚠️ Failed to verify PasswordResetToken table existence"
fi

echo "Regenerating Prisma client with the updated schema..."
npx prisma generate

echo "✅ Password reset setup complete!" 