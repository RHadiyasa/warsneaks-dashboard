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
## Phase 2 — Meta Ads Spy and Opportunity Inbox

1. **Keyword scan form — completed 2026-07-19.** `/meta-ads` accepts a keyword and explicitly selected fixture, manual JSON, or Playwright method.
2. **Playwright worker and fallback — completed.** Live scans create durable `meta_ads.playwright_scan` jobs and execute only in the worker; manual input accepts WarSneaks `ads` and extension `duplicateAds` envelopes. Live execution requires `PLAYWRIGHT_CHROMIUM_PATH`; no personal browser session or credentials are stored.
3. **Canonical data model — completed.** Migration `20260719010000_phase2_meta_ads_opportunities` adds Advertiser, CompetitorAd, AdScan, AdObservation, Opportunity, OpportunityEvidence, and DecisionLog with workspace scoping and unique canonical keys.
4. **Deduplication and observation history — completed.** Source Library ID takes precedence, SHA-256 content fingerprint is fallback, and repeated scans append observations without duplicating canonical ads.
5. **Progress and failure states — completed.** UI exposes busy/queued/running/succeeded/partial/failed states. Failures preserve last-known-good evidence and surface machine-readable codes.
6. **Evidence management — completed.** Ad list/detail supports search, platform/observation context, tags, notes, ad watchlist, and advertiser watchlist storage.
7. **Opportunity workflow — completed.** Multiple selected ads create one watching opportunity, evidence links, an initial decision log, explainable score/confidence, and next action.
8. **Acceptance proof — passed locally and on VPS PostgreSQL.** Two identical fixture scans produced 2 canonical ads with at least 2 observations each; a persisted opportunity scored 45 with confidence 81 and next action `Validate unit economics`. Typecheck, lint, 19 tests, production build, two migrations, and dependency audit all pass.

Architecture decision: `docs/decisions/0004-phase2-canonical-ads.md`. Database proof command: `npm run verify:phase2-db`.
### Live Meta Ads runtime — configured

Local Chrome, an SSH tunnel to the VPS-local PostgreSQL listener, and a continuous polling worker are configured. A controlled public scan for `sepatu sneakers pria` persisted 25 live ads without the extension. See `docs/live-meta-ads.md`.

### Meta Ads data-quality audit and progress modal — completed 2026-07-20

A live-record audit found that stable IDs and observations were correct, while the first parser left many headlines, landing URLs, and platforms empty and sometimes mixed destination-card text into primary copy. The parser now decodes `l.facebook.com` destinations, separates primary text from destination-card content, extracts headline and CTA when exposed, and deduplicates repeated DOM nodes before persistence. Platform remains explicitly labeled unavailable when Meta only exposes unlabeled icons; occasional ads may legitimately lack advertiser/headline/body fields.

The Playwright UI now opens an accessible modal backed by `GET /api/meta-ads/scans/:id`. It polls durable scan/job state every 1.5 seconds and shows queued, worker/browser, normalization, success, partial, failure, and timeout states. Worker claims now mark `AdScan` running, enforce a 75-second browser timeout, and recover stale running jobs after two minutes.

Controlled E2E proof: keyword `Parfum Wanita` completed through the browser UI with 21 unique ads. Sample output includes real advertiser, primary text, product headline, CTA where present, and decoded Shopee/direct landing URLs. All 21 tests, typecheck, lint, build, and dependency audit pass.
## Phase 2 — Meta Ads Library filter contract (completed 2026-07-20)

The Playwright source is the public results page at `https://web.facebook.com/ads/library/`. Every live request now explicitly sends `active_status=active`, `ad_type=all`, `country=<selected ISO code>`, `q=<keyword>`, and `search_type=keyword_unordered`. Indonesia (`ID`) is the UI, API, worker, database, and script default. The UI exposes Region as an input, presents All ads as a locked category, and shows `Region · All ads · Active ads` in the progress modal and scan history.

The scraper reads the result cards shown after the search (the second reference image), identifies each card through its Meta Library ID, and normalizes advertiser, primary text, headline, CTA, start date, active state, landing URL, and duplicate signal where Meta exposes them. It does not scrape only the Ad Library landing/search form.

Verification completed: migration `20260720000000_phase2_scan_country` applied to PostgreSQL; URL tests verify the exact hostname/path and every required parameter; region override is covered; UI contract is covered; 25/25 automated tests, typecheck, and lint pass. A controlled live Indonesia scan for keyword `Gamis` completed with 19 persisted ads (`scan cmrs6ej1x0003wemopc4st2o0`).
## Phase 2 — Incremental auto-scroll and Stop & rangkum (completed 2026-07-20)

1. **Configurable collection target — completed.** The Meta Ads form accepts 10–500 ads (default 100). The value is validated by the API, stored on `AdScan`, and carried in the durable worker payload.
2. **Incremental Playwright auto-scroll — completed.** Playwright scrolls the public results page, waits for lazy-loaded cards, collects by Library ID, stops after the target/no-growth/safety limit, and reports every batch. The stop flag is checked both before parsing the next batch and after saving the current batch.
3. **Durable live progress — completed.** Each new batch is normalized and upserted immediately. `discoveredCount`, `scrollCount`, and `progressMessage` are persisted, allowing the existing 1.5-second status polling to show a rising count without WebSockets. Partial failures retain already-persisted observations.
4. **Graceful Stop & rangkum — completed.** Authenticated `POST /api/meta-ads/scans/:id/stop` records a stop request. The worker closes collection at a safe batch boundary, transitions through `stop_requested` and `summarizing`, then completes as `succeeded` with saved evidence.
5. **Extension-style summary — completed.** The latest scan dashboard shows collected ads, ads belonging to duplicate groups, duplicate groups, groups with at least five instances, and unique advertisers. Duplicate groups use normalized advertiser + primary text + headline + CTA; this is text/content reuse detection, not visual image/video hashing and not a profitability claim.
6. **Database and resilience — completed.** Migration `20260720010000_phase2_incremental_scan` adds progress, target, stop, and summary fields plus explicit scan states. Batch transactions use a 60-second timeout for the VPS PostgreSQL SSH tunnel, and stale/failed jobs preserve partial evidence.
7. **Verification — passed.** 29 automated tests, typecheck, lint, and database migration pass. A controlled Indonesia live scan for `Jam Tangan Wanita` targeted 100, showed a growing counter, received a stop request while collecting, transitioned to summarizing, and completed with 83 saved ads, 31 duplicate ads in 11 groups, 2 high-duplicate groups, and 46 advertisers (`cmrs87wnu0001wezwg298k4p6`).