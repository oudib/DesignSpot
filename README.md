# Sobrus DS — Design Hub

A platform that gathers every Sobrus solution and its design work in one place.

- **Public showcase** — homepage with solution cards → modules → submodules →
  flows → designs (Claude design links). Each flow links to its Linear ticket.
- **Designer workspace** (`/manage`, login-protected) — manage tickets and build
  the whole Solution → Module → Submodule → Flow structure, attaching Claude
  design links and Linear URLs.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Prisma +
Supabase (Postgres) · cookie-based auth (jose + bcrypt) · Server Actions.

## Getting started

1. Create a project at [supabase.com](https://supabase.com).
2. In the dashboard click **Connect** and copy the two connection strings into
   `.env` (see `.env.example`):
   - `DATABASE_URL` — **Transaction pooler** (port 6543, keep `?pgbouncer=true`)
   - `DIRECT_URL` — **Direct connection / Session pooler** (port 5432)
3. Then:

```bash
npm install
npm run setup     # prisma generate + db push + seed (creates tables in Supabase)
npm run dev       # http://localhost:3000
```

The `setup` script pushes the schema to your Supabase database and seeds the six
solutions, a sample Pharma structure, and a demo account.

### Demo login

```
email:    designer@sobrus.com
password: sobrus123
```

## Data model

```
Solution → Module → Submodule → Flow → Design (Claude link)
Flow.linearUrl   — Linear ticket for the flow
Ticket           — designer work item, optionally linked to a Solution + Flow
User             — designer accounts
```

## Useful scripts

| Script             | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start the dev server                          |
| `npm run setup`    | Generate client, push schema, seed data       |
| `npm run db:seed`  | Re-run the seed                               |
| `npm run db:reset` | Wipe the DB and reseed                        |
| `npm run build`    | Production build                              |

## Going to production

- The database is already Supabase (Postgres) — just use a production Supabase
  project and set its connection strings.
- Set a strong `AUTH_SECRET`.
- Add more users via Prisma Studio (`npx prisma studio`) or extend the seed.
- Optional: use `prisma migrate dev` / `prisma migrate deploy` instead of
  `db push` once the schema stabilises, for versioned migrations.
