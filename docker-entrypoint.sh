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

echo "🌱 Seeding database..."
npx prisma db seed

echo "🚀 Starting ATLAS application..."
exec "$@" 