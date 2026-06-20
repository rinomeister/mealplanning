# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# --- Full dependencies (for building) ---
FROM base AS deps
COPY package.json package-lock.json ./
# Skip lifecycle scripts: the postinstall runs `prisma generate`, but the schema
# isn't in this stage. The client is generated later in the builder stage (the
# `build` script runs `prisma generate` after the full source is copied).
RUN npm ci --ignore-scripts

# --- Build the app ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Keep the build within the 2 GB VPS budget (see README if the build OOMs).
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN npm run build

# --- Production-only dependencies ---
FROM base AS proddeps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# --- Runtime image ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/generated ./src/generated
COPY package.json next.config.ts prisma.config.ts ./
COPY prisma ./prisma
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
