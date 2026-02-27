#!/bin/sh

set -e

echo "Starting Distill..."

# Create data directories and ensure the app user owns them
mkdir -p /data/repos
chown -R nextjs:nodejs /data

echo "Running database migrations..."
su-exec nextjs npx prisma migrate deploy

echo "Initializing admin user..."
su-exec nextjs npm run db:init

echo "Starting application..."

exec su-exec nextjs "$@"
