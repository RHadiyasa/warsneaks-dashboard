# ADR 0003: Phase 1 runtime and local degradation

Status: Accepted (2026-07-19)

WarSneaks uses one TypeScript monorepo with a Next.js web runtime, a separate worker entry point, shared domain/types packages, and PostgreSQL through Prisma. Long work is represented by durable `BackgroundJob` rows and is not executed in route handlers in production.

When `DATABASE_URL` is absent, the Phase 1 command shell uses deterministic demo data and an in-memory sample-job adapter. This supports UI development and acceptance checks without pretending persistence exists. When configured, the dashboard repository executes Prisma queries against seeded integration and job rows. Production must configure PostgreSQL, a strong `AUTH_SECRET`, and a changed owner password.