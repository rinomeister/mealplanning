#!/bin/sh
set -e

echo "→ Applying database migrations (prisma migrate deploy)…"
./node_modules/.bin/prisma migrate deploy

echo "→ Starting MealPlan on port ${PORT:-3000}…"
exec npm run start
