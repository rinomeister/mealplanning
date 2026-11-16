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
  that share a name and a compatible unit — `500 g` + `0.75 kg` of flour becomes one `1.25 kg`
  line (mass and volume convert; other units only merge with themselves) — and shows `+` when
  some occurrences had no quantity. Planned products are listed too (as grams). Items are grouped
  by aisle — guessed from English/Croatian keywords in `src/lib/aisles.ts`, overridable per
  item from its `⋮` menu — and can be marked **already at home**, which keeps them off the list
  until you tap "Need it". "Clear checked" only clears this trip's ticks.
- **Entries keep their own macros.** Logging a meal, product or quick add copies its macros onto
  the day entry. Editing a meal or product afterwards updates today and future entries only, so
  past days never change.
- **Quick add** logs bare macros (no meal or product) — e.g. restaurant food. Leave kcal blank
  and it's estimated from protein/carbs/fat.
- **Copying**: a slot (`⋮` menu on Track), a whole day ("Same as yesterday" / "Copy a day" on
  Track) or a whole week ("Repeat a week" on Plan). Copies are appended as planned.
- **Products** can carry named **portions** ("1 slice = 25 g") shown as one-tap buttons when
  logging. Pickers can also **search Open Food Facts by name** (search.openfoodfacts.org) when
  a food isn't in your products yet.
- **Meal sharing**: Share on a meal gives an 8-character code and a `/share/<code>` link. The
  recipient previews the meal and imports their own independent copy (tags matched by name).
  "Stop sharing" kills the code; existing copies stay.
- **Favorites and recents**: star products (per user) or meals; the Track pickers show
  Favorites and Recent first, and remember last time's amount ("+ 150 g" logs it again).
- **Save as meal** lives in a section's `⋮` menu, under any section with 2+ items, and in the
  meal picker.
- **Weighing the pot**: give a meal its cooked batch weight (meal page or form) and it's logged
  in grams; servings = grams × serves ÷ batch weight. Re-weighing a new pot rescales today's and
  future entries (their grams stay); past days are untouched.
- **Deleting a meal or product** never touches history: entries on past days (or already
  eaten) are kept by name with the numbers they had — "Skyr · 150 g" — and upcoming plans for
  it are removed. The confirmation says how many plans that is.
- **Servings**: a meal describes one serving; each calendar entry has a `servings` multiplier that
  scales both macros (day totals) and shopping quantities.
- **Day status**: entries default to `PLANNED`. Unchecking "ate this" marks an entry `SKIPPED`
  (excluded from day macro totals). The shopping list only pulls `PLANNED` (not-yet-eaten) meals.
