# MealPlan

A self-hosted **meal-planning PWA**: store meals (hybrid ingredients, prep steps, macros, tags),
plan them on a calendar by slot, auto-generate a shopping list from upcoming meals, and track bodyweight.

**Stack:** Next.js 16 (App Router) · Prisma 7 + PostgreSQL (pg driver adapter) · Auth.js (credentials) ·
Tailwind v4 · Serwist (PWA). Multi-user, mobile-first, installable.

## Local development

1. **Database** — the app needs PostgreSQL. Easiest is Docker:
   ```bash
   docker compose up -d        # starts Postgres on localhost:5432
   ```
   No Docker? Point `DATABASE_URL` in `.env` at any Postgres (a native install, Neon free tier,
   or even your Coolify database).

2. **Env** — copy and adjust:
   ```bash
   cp .env.example .env
   # set DATABASE_URL and a real AUTH_SECRET (npx auth secret)
   ```

3. **Install + migrate + run:**
   ```bash
   npm install
   npm run db:migrate     # creates tables (prisma migrate dev)
   npm run dev            # http://localhost:3000
   ```

Register an account at `/register` (default tags are created automatically), then add meals,
plan days, and build a shopping list.

### Useful scripts
| Script | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build (also emits `public/sw.js`) |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:studio` | Prisma Studio |

## Deploying on Coolify

1. **Create a PostgreSQL resource** in Coolify. Copy its connection string.
2. **Create an Application** from this repo using the included **Dockerfile** (build pack: Dockerfile).
3. **Environment variables** on the app:
   - `DATABASE_URL` — the Coolify Postgres connection string
   - `AUTH_SECRET` — a long random string (`openssl rand -base64 32`)
   - `AUTH_URL` — your public HTTPS URL (e.g. `https://meals.example.com`)
4. **Port:** the container listens on `3000`. Health check: `GET /api/health`.
5. Deploy. On every start, the container runs `prisma migrate deploy` automatically
   (see `docker-entrypoint.sh`) and then starts the server.

### 2 GB RAM notes
- The Docker build sets `NODE_OPTIONS=--max-old-space-size=1536`. Make sure the VPS has **swap**
  enabled so `next build` doesn't get OOM-killed.
- If the build still OOMs on the VPS, build the image elsewhere (CI / locally) and push it, or
  temporarily increase swap during deploys.
- Tune Postgres small (e.g. `shared_buffers=128MB`) — fine for a personal app.

## How a few things work
- **Ingredients** are hybrid: `qty` + `unit` + `name`, all optional. The shopping list sums items
  that share a name+unit and shows `+` when some occurrences had no quantity.
- **Servings**: a meal describes one serving; each calendar entry has a `servings` multiplier that
  scales both macros (day totals) and shopping quantities.
- **Day status**: entries default to `PLANNED`. Unchecking "ate this" marks an entry `SKIPPED`
  (excluded from day macro totals). The shopping list only pulls `PLANNED` (not-yet-eaten) meals.
