# WarSneaks Implementation Documentation

## Phase 0 Ã¢â‚¬â€ Feasibility and Domain Decisions

1. **Existing extension inspected Ã¢â‚¬â€ completed 2026-07-19.** Manifest V3 extension v2.9.3 was reviewed without edits. Its DOM scan, storage, Library-ID parsing, and `duplicateAds` export informed ADR 0001.
2. **Meta Ads live-scan feasibility assessed Ã¢â‚¬â€ completed as documented failure.** Playwright and an authorized session are absent, so no live result is claimed. Preconditions and risks are in `docs/meta-ads-feasibility.md`.
3. **Extension JSON/manual fallback Ã¢â‚¬â€ completed.** `scripts/normalize-meta-ads.mjs` accepts `{ ads }` and extension `{ duplicateAds }`, returning canonical ads and per-run observations.
4. **Sanitized fixtures Ã¢â‚¬â€ completed.** Fictional fixtures cover ads, orders, stock, spend, fees, and refunds. Domains use `.invalid`.
5. **Financial/attribution definitions Ã¢â‚¬â€ completed.** ADR 0002 and `docs/calculations.md` lock revenue, COGS, contribution profit, weighted-average inventory cost, cashflow separation, and attribution.
6. **Architecture decisions Ã¢â‚¬â€ completed.** Two ADRs cover ingestion identity and money/inventory/attribution.
7. **Data dictionary/calculation specification Ã¢â‚¬â€ completed.** The hand scenario has executable BigInt proof and regression tests.
8. **Acceptance evidence Ã¢â‚¬â€ completed.** One keyword yields stable normalized IDs; a repeated import maps to the same canonical ad but a different observation; contribution profit is IDR 10,500 and net cashflow IDR -389,500; access/legal/rate/session risks are documented.

Validation: `npm test` and `npm run phase0:normalize`.

## Phase 1 â€” Foundation and Command Shell

1. **Monorepo structure â€” completed 2026-07-19.** `apps/web`, `apps/worker`, and `packages/db`, `domain`, and `shared` are wired through root scripts and TypeScript aliases.
2. **Web and worker runtimes â€” completed.** Next.js App Router builds as the web runtime; `npm run worker` exercises the isolated job lifecycle contract.
3. **PostgreSQL and Prisma foundation — completed.** Schema, initial SQL migration, typed Prisma client, idempotent seed, and repository query were verified against PostgreSQL 16.14 on VPS `76.13.17.122` using a database-local dedicated role.
4. **Single-user authentication â€” completed.** Login validates input, issues an HTTP-only signed cookie, supports logout, and middleware protects `/dashboard`.
5. **Responsive navigation and Command Center â€” completed.** Grouped navigation, global date/channel filters, traceable seed KPI cards, priority actions, integration freshness, and recent jobs adapt across desktop/mobile widths.
6. **Background jobs â€” completed for Phase 1 contract.** Queued â†’ running â†’ succeeded transitions are validated, illegal transitions fail, sample API jobs are displayed immediately, and PostgreSQL has durable/idempotent job fields.
7. **Audit and integration health â€” completed foundation.** Prisma models/migration and audit helper exist; freshness shows healthy/stale/error semantics without deleting last-known-good data.
8. **System states â€” completed.** Loading, empty, error, and stale presentations are explicit.
9. **Verification — passed.** Fresh `npm ci`, Prisma generate, PostgreSQL migrate and seed, typecheck, lint, 9 tests, production build, worker lifecycle proof, and dependency audit all pass. VPS source: `/root/visa-warsneaks-dashboard`; secrets use file mode `600`.

Runbook: `docs/phase-1-runbook.md`. Architecture: ADR 0003.