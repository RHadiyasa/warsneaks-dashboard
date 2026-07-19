# Phase 1 Runbook

## Local prerequisites

- Node.js 20 or newer
- PostgreSQL reachable through `DATABASE_URL`

## Fresh setup

```text
copy .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
```

Default development login is `owner@warsneaks.local` / `change-me-before-production`; replace both password and `AUTH_SECRET` outside local development.

Without PostgreSQL, the UI intentionally falls back to deterministic Phase 0/1 demo metrics. Migration and seed are not considered verified until run against a real PostgreSQL instance.