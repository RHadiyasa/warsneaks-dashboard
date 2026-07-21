# WarSneaks Business Command Center

## Final Product, Architecture, and Vibe-Coding Build Plan

Status: final product blueprint  
Default locale: Indonesia  
Default currency: IDR  
Default timezone: Asia/Jakarta

---

## 1. Product Vision

WarSneaks adalah pusat kendali bisnis pribadi yang menghubungkan riset pasar, keputusan pembelian, supplier, stok, iklan, penjualan, customer service, cashflow, dan profit dalam satu sistem.

Dashboard harus menjawab tiga pertanyaan setiap hari:

1. Peluang apa yang paling layak diambil?
2. Tindakan apa yang harus dilakukan sekarang?
3. Berapa stok, uang, risiko, dan keuntungan bisnis yang sebenarnya?

WarSneaks bukan sekadar dashboard visual. Setiap insight harus dapat berubah menjadi action yang bisa disetujui, ditunda, ditolak, atau diselesaikan oleh pengguna.

### North-star workflow

```text
Market signals
Meta Ads Spy + Google Trends + marketplace + competitor
        |
        v
Opportunity and decision
watch -> validate -> buy sample -> test -> scale/reject
        |
        v
Sourcing and procurement
supplier -> quote -> landed cost -> purchase order
        |
        v
SKU and inventory
goods receipt -> stock ledger -> reservation -> reorder
        |
        v
Marketing and sales
campaign -> spend -> order -> fulfillment -> return
        |
        v
Finance and profitability
revenue -> COGS -> fees -> contribution profit -> cashflow
        |
        v
Learning loop
scale -> pause -> restock -> reprice -> discontinue
```

---

## 2. Product Principles

1. **Action-first**: insight tanpa tindakan lanjutan tidak cukup.
2. **One source of truth**: KPI harus dapat ditelusuri kembali ke transaksi sumber.
3. **Actual and estimate are different**: angka aktual, estimasi, dan platform-reported tidak boleh dicampur.
4. **Profit is not revenue**: omzet, gross profit, contribution profit, operating profit, dan cashflow ditampilkan terpisah.
5. **Human approval for consequential actions**: pembelian, perubahan harga, peluncuran iklan, dan perubahan budget membutuhkan persetujuan pengguna.
6. **Ledger over mutable totals**: stok dan uang berasal dari transaksi, bukan angka total yang diedit tanpa histori.
7. **Graceful degradation**: ketika scraper atau connector gagal, data lama tetap dapat dipakai dan sistem menjelaskan freshness-nya.
8. **Manual/CSV before fragile automation**: satu vertical slice yang utuh lebih penting daripada banyak integrasi setengah jadi.
9. **Evidence-based recommendation**: setiap rekomendasi menyertakan alasan, data, confidence, dan dampak yang diperkirakan.
10. **Build narrow, design extensible**: implementasi tetap single-user dan sederhana, tetapi boundary domain tidak mengunci pengembangan berikutnya.

---

## 3. Business Lifecycle

### 3.1 Opportunity lifecycle

```text
discovered
  -> watching
  -> validating
  -> sample_ordered
  -> testing
  -> validated
  -> scaling
  -> paused | rejected | discontinued
```

Setiap perubahan status mencatat siapa, kapan, alasan, dan bukti pendukung.

### 3.2 Purchase order lifecycle

```text
draft -> approved -> ordered -> partially_received -> received
      -> cancelled
```

### 3.3 Order lifecycle

```text
pending -> paid -> processing -> fulfilled -> completed
        -> cancelled | returned | refunded
```

### 3.4 Action lifecycle

```text
open -> approved -> in_progress -> completed
     -> snoozed | dismissed | expired
```

---

## 4. Product Modules

## 4.1 Executive Command Center

Home harus menampilkan kondisi bisnis dan prioritas tindakan, bukan kumpulan chart dekoratif.

Komponen utama:

- Revenue, orders, contribution profit, cash in/out, dan ad spend.
- Stock value, low-stock risk, stockout risk, dan dead stock.
- Campaign winners/losers dan break-even alerts.
- Opportunity baru dari market intelligence.
- PO terlambat dan supplier yang perlu ditindaklanjuti.
- Return/complaint anomalies.
- Forecast 7, 30, dan 90 hari.
- Action queue berurutan berdasarkan urgency dan estimated impact.
- Data freshness dan integration health.

Semua KPI menggunakan filter global periode, channel, SKU, supplier, dan campaign.

## 4.2 Market Intelligence

Sumber data:

- Meta Ads Library Spy.
- Google Trends.
- Marketplace product listings.
- Competitor and advertiser watchlists.
- Manual research notes and evidence.

Kemampuan:

- Search dan scan keyword.
- Simpan advertiser, creative, landing page, CTA, media metadata, dan start date.
- Catat ad observation antar-scan.
- Catat harga, sold count, rating, review count, dan availability listing antar-crawl.
- Bandingkan keyword, competitor, offer, price band, dan creative pattern.
- Buat `Opportunity` dari satu atau beberapa evidence.
- Alert jika advertiser baru, creative reuse meningkat, harga berubah, atau listing menghilang.

Catatan: creative reuse/duplicate count adalah sinyal, bukan bukti pasti profitabilitas.

## 4.3 Opportunity and Experiment Center

Setiap opportunity memiliki:

- Nama dan target market.
- Evidence dari Meta Ads, Trends, marketplace, atau catatan manual.
- Expected selling price.
- Estimated landed cost.
- Low/base/high sales scenario.
- Opportunity score dan confidence score.
- Assumptions, risks, notes, owner, dan next action.
- Experiment history.
- Decision log.
- Link ke SKU jika opportunity dipromosikan menjadi produk milik sendiri.

Actions:

- Watch.
- Reject.
- Order sample.
- Request supplier quote.
- Create test plan.
- Promote to SKU.
- Scale, pause, atau discontinue.

## 4.4 Catalog and Pricing

- Owned SKU dan variants.
- Product status: sourcing, test, active, paused, discontinued.
- Channel listings dipisahkan dari SKU internal.
- Price history dan price rules.
- Bundle dan simple product relationships setelah MVP.
- Price simulator berdasarkan biaya, fee, discount, target margin, dan ad spend.
- Minimum viable selling price dan break-even price.

## 4.5 Supplier and Procurement

- Supplier directory.
- Multiple quotes per SKU.
- MOQ, lead time, payment terms, defect rate, dan notes.
- Landed cost calculator.
- Purchase order dan line items.
- Partial goods receipt.
- Supplier payment status.
- Supplier scorecard.
- Purchase recommendation berdasarkan demand, stock, cash, lead time, dan trend.

Dashboard hanya membuat draft/recommendation pada MVP. Pemesanan aktual tetap membutuhkan approval pengguna.

## 4.6 Inventory

Inventory menggunakan transaction ledger.

Stock movement types:

- opening_balance
- purchase_receipt
- sale
- return_in
- return_out
- damaged
- sample
- adjustment
- transfer_in
- transfer_out
- reservation
- reservation_release

Kemampuan:

- Physical locations.
- Channel reservations.
- Available, reserved, inbound, damaged, dan on-hand quantities.
- Weighted-average costing untuk MVP.
- Stock aging.
- Days of inventory.
- Reorder point dan safety stock.
- Dead-stock and stockout alerts.
- Stock opname dan reconciliation.

Stock per marketplace bukan stok fisik terpisah. Marketplace adalah channel listing/reservation; stok fisik berada di inventory location.

## 4.7 Marketing

Pisahkan dua jenis data:

1. Competitor ads dari Meta Ads Spy.
2. Campaign dan creative milik sendiri.

Kemampuan campaign sendiri:

- Campaign, ad set/group, creative, dan linked SKU.
- Planned budget dan actual spend.
- Platform-reported revenue dan internally observed revenue disimpan terpisah.
- Orders dan revenue attribution.
- ROAS, MER, CAC, conversion rate, dan break-even ROAS.
- Creative experiment log.
- Scale/pause recommendation.
- Link competitor evidence ke creative experiment tanpa menganggap creative tersebut boleh disalin.

Pada MVP, pengguna membuat campaign plan dan mencatat/import performa. Launch atau perubahan budget otomatis melalui official API masuk fase lanjutan dan selalu membutuhkan approval.

## 4.8 Sales and Fulfillment

- Sales channels dan store accounts.
- Orders dan order items.
- Discounts, marketplace fees, payment fees, affiliate fees, dan shipping subsidy.
- Payment, fulfillment, cancellation, return, dan refund.
- Import CSV/manual terlebih dahulu.
- Official API/webhook connectors setelah vertical slice stabil.
- Settlement reconciliation pada fase lanjutan.

## 4.9 Customer Service and Returns

- Tickets linked ke order, customer, dan SKU.
- Complaint and return reason taxonomy.
- SLA dan resolution status.
- Defect/complaint aggregation per SKU dan supplier.
- Return loss calculation.
- Feedback loop ke supplier score dan opportunity review.

## 4.10 Finance and Profitability

Dashboard membedakan profitabilitas dan cashflow.

```text
Gross Sales
- Discounts
- Refunds
= Net Sales

Net Sales
- COGS
= Gross Profit

Gross Profit
- Marketplace fees
- Payment fees
- Shipping subsidies
- Affiliate/commission fees
- Ad spend
- Return losses
= Contribution Profit

Contribution Profit
- Fixed operating expenses
- Estimated tax allocation
= Estimated Operating Profit
```

Kemampuan:

- Profit per SKU, order, channel, campaign, dan periode.
- Cash in and cash out.
- Supplier payable dan channel settlement.
- Fixed and variable expenses.
- Inventory valuation.
- Budget and cash runway.
- Low/base/high profit projection.
- Export untuk akuntansi eksternal.

WarSneaks bukan software akuntansi formal pada MVP. Semua laporan yang belum accounting-grade diberi label `operational estimate`.

## 4.11 Action Center

Action Center adalah fitur pembeda utama.

Setiap action menyimpan:

- Type dan recommended action.
- Reason.
- Evidence links.
- Estimated financial impact.
- Confidence.
- Priority.
- Due/expiry date.
- Approval requirement.
- Status dan completion notes.

Contoh actions:

- Buy a product sample.
- Request supplier quote.
- Create or approve a draft PO.
- Reorder before stockout.
- Review dead stock.
- Adjust selling price.
- Scale or pause campaign.
- Follow up late supplier.
- Review high-return SKU.
- Discontinue unprofitable SKU.

---

## 5. Information Architecture

Navigation groups:

```text
Command
  Home
  Actions
  Notifications

Intelligence
  Research
  Meta Ads Spy
  Competitors
  Opportunities

Operations
  Catalog
  Suppliers
  Purchase Orders
  Inventory
  Sales
  Customers

Growth
  Campaigns
  Creatives
  Experiments

Control
  Finance
  Reports
  Data Quality
  Integrations
  Settings
```

### Home layout priority

1. Critical alerts and actions.
2. Today/period financial snapshot.
3. Sales, marketing, and inventory health.
4. Opportunities and experiments.
5. Forecast and trend.
6. Data freshness.

---

## 6. Metrics and Calculation Rules

### 6.1 Money

- Gunakan decimal-safe representation, bukan JavaScript floating point untuk kalkulasi finansial.
- Setiap amount menyimpan currency.
- IDR adalah default, tetapi schema tidak boleh mengunci satu currency.
- Pembulatan dilakukan di boundary presentasi atau settlement, bukan di tengah kalkulasi.

### 6.2 Inventory cost

- MVP menggunakan weighted-average cost.
- Cost berubah saat goods receipt diterima.
- COGS order menggunakan cost snapshot saat sale diposting.
- Cost historis tidak berubah ketika supplier quote baru masuk.

### 6.3 Marketing metrics

```text
ROAS = attributed revenue / ad spend
MER = total net sales / total ad spend
CAC = ad spend / new customers
Contribution Margin Before Ads = contribution before ad spend / net sales
Break-even ROAS = 1 / contribution margin before ads
```

Platform-reported attribution dan internal/blended attribution harus ditandai jelas.

### 6.4 Forecast

- Selalu tampilkan low/base/high scenario.
- Simpan assumptions dan model version.
- Tampilkan confidence dan data freshness.
- Forecast tidak boleh ditampilkan sebagai nilai pasti.

### 6.5 Opportunity scoring

Initial score:

```text
raw score =
  unitEconomicsScore * 0.25 +
  demandScore * 0.20 +
  adValidationScore * 0.15 +
  competitionScore * 0.15 +
  operationalFitScore * 0.15 +
  supplierReliabilityScore * 0.10

final score = max(0, raw score - riskPenalty)
```

Rules:

- Semua component score dinormalisasi 0-100.
- Missing data menurunkan confidence, bukan diam-diam dianggap nol.
- Breakdown, scoring version, dan evaluatedAt disimpan.
- Score adalah filter keputusan, bukan keputusan otomatis.

---

## 7. Core Domain Model

Model berikut adalah target domain, bukan perintah untuk membuat semua tabel pada Phase 1.

### 7.1 Platform and integration

- `Workspace`
- `User`
- `SourceAccount`
- `SyncJob`
- `SyncRun`
- `WebhookEvent`
- `AuditLog`

### 7.2 Research and opportunity

- `Keyword`
- `ResearchRun`
- `Opportunity`
- `OpportunityEvidence`
- `Experiment`
- `DecisionLog`

### 7.3 Meta Ads intelligence

- `Advertiser`
- `CompetitorAd`
- `AdScan`
- `AdObservation`
- `MediaAsset`

Important constraints:

- `CompetitorAd` menyimpan `source`, `sourceAdId`, `contentFingerprint`, dan `startedRunningAt`.
- Gunakan source ad/library ID sebagai stable identity jika tersedia.
- Gunakan stable content fingerprint sebagai fallback.
- Scan ulang menambahkan `AdObservation`, bukan membuat ad kanonik baru.
- Satu ad dapat menjadi evidence bagi banyak keyword dan opportunity.

### 7.4 Marketplace intelligence

- `MarketListing`
- `ListingSnapshot`
- `Seller`

Satu listing dapat ditemukan dari banyak keyword. Relasi keyword/listing berada pada research result/evidence, bukan foreign key tunggal di listing.

### 7.5 Owned products and sourcing

- `Sku`
- `SkuVariant`
- `ChannelListing`
- `Supplier`
- `SupplierQuote`
- `PurchaseOrder`
- `PurchaseOrderLine`
- `GoodsReceipt`
- `GoodsReceiptLine`

### 7.6 Inventory

- `InventoryLocation`
- `StockMovement`
- `StockReservation`
- `InventoryCount`

`StockBalance` sebaiknya berupa calculated view/read model dari ledger, bukan sumber kebenaran yang diedit langsung.

### 7.7 Marketing and sales

- `Campaign`
- `AdGroup`
- `Creative`
- `AdSpend`
- `AttributionRecord`
- `SalesChannel`
- `Order`
- `OrderLine`
- `Payment`
- `Fulfillment`
- `Return`
- `Refund`
- `Settlement`

### 7.8 Finance and customer operations

- `Expense`
- `MoneyTransaction`
- `CsTicket`
- `Customer`
- `ActionItem`
- `Notification`

### 7.9 Cross-cutting fields

External/synced records memiliki:

- `workspaceId`
- `source`
- `externalId`
- `sourceAccountId`
- `sourceUpdatedAt`
- `lastSyncedAt`
- `raw` or source payload reference when useful
- `createdAt`
- `updatedAt`

Semua external writes harus idempotent. Unique constraint ditentukan dari source account dan external ID.

---

## 8. Technical Architecture

### 8.1 Repository structure

```text
warsneaks-dashboard/
  apps/
    web/                   # Next.js UI, API, auth
    worker/                # scraping, sync, scheduled jobs
  packages/
    db/                    # Prisma schema, migrations, seed
    domain/                # calculations, state machines, rules
    connectors/            # Meta, marketplace, CSV adapters
    shared/                # types, schemas, constants
    ui/                    # shared UI components when needed
  fixtures/                # sanitized scraper/import fixtures
  docs/
    decisions/             # architecture decision records
    data-dictionary.md
    calculations.md
  warsneaksplan.md
  .env.example
  package.json
```

Keep one monorepo and one language for the initial system. Do not introduce a separate Python service unless a proven connector requires it.

### 8.2 Runtime responsibilities

#### Web app

- UI and authentication.
- Input validation.
- Fast CRUD operations.
- Creates background jobs.
- Polls or subscribes to job progress.
- Never runs long Playwright scans inside a request.

#### Worker

- Playwright scanners.
- Connector sync.
- CSV processing.
- Media processing.
- Snapshot creation.
- Recalculation and forecasting.
- Scheduled actions and alerts.

#### Database

- Canonical operational data.
- Job and sync state.
- Audit trail.
- Calculation inputs and snapshots.

#### Object storage

- Media archive when enabled.
- Import files.
- Export files.
- Large raw payloads if retention is required.

Do not store permanent media as server-local paths in production. Use S3-compatible object storage and keep metadata in PostgreSQL.

### 8.3 Recommended stack

- Next.js App Router and TypeScript.
- PostgreSQL.
- Prisma ORM.
- Tailwind CSS and accessible component primitives.
- Zod or equivalent schema validation.
- Playwright in the worker.
- A durable background-job mechanism; database-backed is acceptable for MVP.
- Recharts or another focused chart library.
- S3-compatible object storage when media archival is enabled.
- Structured logging and error reporting.

Avoid coupling domain logic to route handlers or React components.

### 8.4 Request and job flow

```text
UI
 -> validated API request
 -> create job with idempotency key
 -> worker claims job
 -> connector/scraper runs
 -> normalized records and snapshots saved transactionally
 -> progress/status updated
 -> UI receives/polls status
 -> action rules evaluate new data
```

Job status:

```text
queued -> running -> succeeded
                  -> partial
                  -> failed
                  -> cancelled
```

Every job stores attempts, per-source errors, startedAt, finishedAt, and summarized result counts.

### 8.5 Connector contract

Every connector implements the same boundary:

- Validate configuration.
- Test connection/access.
- Fetch or import raw source data.
- Normalize into domain input types.
- Upsert idempotently.
- Record checkpoints and freshness.
- Return structured partial failures.

Own-business data should prefer official APIs, webhooks, or CSV. Scraping is primarily for public market intelligence.

### 8.6 Security

- Encrypt connector tokens and sensitive session state.
- Never log passwords, cookies, tokens, payment details, or personal customer data.
- Validate URLs and uploaded CSV files.
- Apply authorization checks on all server mutations.
- Rate-limit scan and import endpoints.
- Record approval and audit events for consequential actions.
- Use least-privilege connector permissions.
- Provide retention/deletion controls for raw data and media.

### 8.7 Reliability and data quality

- Display `last synced` and stale-data warnings.
- Keep scraper fixtures for regression tests.
- Store raw source snippets only when necessary for debugging.
- Detect duplicates before creating canonical records.
- Reconciliation views compare source totals with imported totals.
- Partial connector failure must not erase last known good data.

---

## 9. API and Service Conventions

Suggested boundaries:

```text
POST /api/research/runs
POST /api/meta-ads/scans
GET  /api/jobs/:id
POST /api/opportunities
POST /api/opportunities/:id/promote-to-sku
POST /api/purchase-orders
POST /api/purchase-orders/:id/approve
POST /api/goods-receipts
POST /api/imports/orders
POST /api/imports/ad-spend
GET  /api/dashboard/summary
GET  /api/profitability
POST /api/actions/:id/approve
POST /api/actions/:id/dismiss
```

Conventions:

- Validate input at the API boundary.
- Business logic lives in domain services.
- Use transactions for multi-record state changes.
- Mutation endpoints accept idempotency keys when retries are possible.
- Return machine-readable error codes.
- Paginate large lists.
- Never return unbounded raw payloads to the UI.

---

## 10. Build Phases

Build one phase at a time. Do not start the next phase until its acceptance gate passes.

## Phase 0 - Feasibility and Domain Decisions

### Objective

Remove the highest technical and business unknowns before building the full UI.

### Deliverables

- [x] Inspect the existing Meta Ads Spy extension as read-only reference.
- [x] Prove one Meta Ads Library scan using Playwright or document why it fails.
- [x] Provide extension JSON/manual import as fallback path.
- [x] Produce sanitized fixtures for ads, orders, stock, spend, fees, and refunds.
- [x] Lock definitions for revenue, COGS, contribution profit, inventory cost, and attribution.
- [x] Record architecture decisions in `docs/decisions/`.
- [x] Create a data dictionary and calculation specification.

### Acceptance gate

- [x] One keyword produces normalized ad fixtures with stable identity.
- [x] A repeated scan can be mapped to the same canonical ad.
- [x] One sample business scenario can be calculated by hand from purchase to profit.
- [x] Known access, legal, rate-limit, and session risks are documented.

### Do not build yet

- Full dashboard.
- Automated media downloading.
- Multiple marketplace scrapers.

## Phase 1 - Foundation and Command Shell

### Objective

Create a stable application foundation and visible system health.

### Deliverables

- [x] Monorepo structure.
- [x] Web app and worker app.
- [x] PostgreSQL and initial Prisma migrations.
- [x] Authentication and default single-user workspace.
- [x] Glossy, responsive, and accessible login experience without a pre-filled password.
- [x] Production-safe authentication redirects and reliable native login form submission.
- [x] Base navigation and responsive shell.
- [x] Background job lifecycle.
- [x] Audit logging.
- [x] Source/integration health model.
- [x] Global date/channel filters.
- [x] Seed data for demo and tests.
- [x] Empty Command Center with real queries against seed data.

### Acceptance gate

- [x] Fresh install, migrate, seed, build, lint, and tests pass.
- [x] Web app can enqueue a sample job and display its completion.
- [x] Protected routes reject unauthenticated access.
- [x] Dashboard clearly handles loading, empty, error, and stale states.

## Phase 2 - Meta Ads Spy and Opportunity Inbox

### Objective

Turn market signals into durable evidence and business decisions.

### Deliverables

- [x] Keyword scan form.
- [x] Playwright worker scan plus JSON/manual import fallback.
- [x] `Advertiser`, `CompetitorAd`, `AdScan`, and `AdObservation` models.
- [x] Stable source ID/fingerprint deduplication.
- [x] Scan progress and partial error UI.
- [x] Configurable scan target (10-500), incremental auto-scroll, and durable live result count.
- [x] Graceful `Stop & rangkum` flow with collecting, stop-requested, summarizing, and succeeded states.
- [x] Extension-style duplicate, instance, high-duplicate, and advertiser summary.
- [x] Ad list/detail, filters, tags, notes, and watchlist.
- [x] Advertiser watchlist.
- [x] Observation history.
- [x] Create opportunity from one or multiple ads.
- [x] Opportunity lifecycle and decision log.
- [x] Basic evidence-based score and confidence.
- [x] Durable `ScanInsight` model and independent `meta_ads.analyze_scan` job.
- [x] Evidence-grounded DeepSeek Flash synthesis with strict JSON validation and retry.
- [x] Insight-first market brief for product signals, duplicates, winning angles, actions, and risks.
- [x] Raw-ad evidence drawer and redesigned advertiser/ad detail workspace.
- [x] Plus Jakarta Sans and React Bits motion/metric/spotlight components.

### Acceptance gate

- [x] Running the same fixture twice creates one canonical ad and two observations.
- [x] Failed scans do not erase existing data.
- [x] User can move from scan result to a saved opportunity and next action.
- [x] Scraper normalization has fixture-based regression tests.
- [x] DeepSeek output is schema-validated, live-tested, and retryable without rerunning Playwright.
- [x] API credentials are environment-only and absent from tracked source.

### Deferred

- Automatic permanent media archival.
- Claims that duplicate count equals profitability.
- Automated ad campaign creation.

## Phase 3 - Sourcing, SKU, Purchase, and Inventory

### Objective

Turn a validated opportunity into owned stock with traceable cost.

### Deliverables

- Promote opportunity to SKU.
- SKU and variant management.
- Supplier and quote management.
- Landed cost and price simulator.
- Draft/approve purchase order.
- Partial/full goods receipt.
- Inventory locations.
- Stock movement ledger and reservations.
- Weighted-average cost.
- Inventory balance, aging, and low-stock views.
- Reorder and late-PO rule-based actions.

### Acceptance gate

- A user can promote opportunity -> create SKU -> add supplier quote -> approve PO -> receive stock.
- Stock balance is reproducible from stock movements.
- Editing a new quote does not rewrite historical COGS.
- Duplicate receipt submissions are idempotent.

## Phase 4 - Marketing, Sales, Finance, and MVP Closure

### Objective

Close the first complete business loop and show actual operational profitability.

### Deliverables

- Campaign and creative planning.
- Manual and CSV imports for ad spend and orders.
- Fees, discounts, payments, fulfillment, returns, and refunds.
- COGS snapshot on sales.
- Revenue, gross profit, contribution profit, and cashflow calculations.
- Profitability by SKU, channel, and campaign.
- ROAS, MER, CAC, and break-even calculations.
- Command Center populated with actual domain queries.
- Initial Action Center rules: reorder, dead stock, pause/scale review, and margin warning.
- CSV export.

### MVP acceptance gate

- User can scan an ad and create an opportunity.
- Opportunity can become a purchased and received SKU.
- Orders and ad spend can be imported.
- Dashboard calculates actual contribution profit for the SKU.
- User receives explainable scale/pause/reorder actions.
- Every displayed KPI can be traced to source transactions.
- The full demo flow works without an external spreadsheet as the primary source of truth.

## Phase 5 - Customer Service, Returns, and Operational Control

### Objective

Feed quality, customer, supplier, and cash signals back into decisions.

### Deliverables

- Customer and CS ticket module.
- Complaint/return reason taxonomy.
- Return loss calculation.
- Supplier quality and delivery scorecard.
- Payable and settlement tracking.
- Stock opname and reconciliation.
- Weekly executive digest.
- Expanded alerts and action prioritization.

### Acceptance gate

- Return/complaint patterns are visible per SKU and supplier.
- Supplier recommendations use actual lead-time and defect evidence.
- Settlement and order totals can be reconciled.

## Phase 6 - Additional Market Intelligence

### Objective

Improve opportunity quality using independent demand and competition signals.

### Deliverables

- Google Trends connector.
- One marketplace connector first.
- Canonical market listing and listing snapshots.
- Keyword-to-result many-to-many relation.
- Price, sold-count, rating, review, and availability history.
- Cross-source opportunity score.
- Competitor price and new-listing alerts.

### Acceptance gate

- One marketplace connector passes fixtures and a controlled live test.
- Listing identity remains stable across multiple keywords and crawls.
- Missing source data lowers confidence and does not silently corrupt the score.

## Phase 7 - Official Integrations and Automation

### Objective

Reduce manual imports after the internal data model is proven.

### Deliverables

- Official store/marketplace connectors where available.
- Webhook ingestion.
- Meta Marketing connector where authorized.
- Scheduled sync and retry policies.
- Token encryption and reconnect flows.
- Settlement reconciliation.
- Approval workflow for campaign and purchasing actions.

### Acceptance gate

- Replayed webhook/sync events are idempotent.
- Connector failure produces visible partial status and does not delete data.
- Consequential external mutations require explicit approval and audit records.

## Phase 8 - Forecasting and Optimization

### Objective

Use sufficient historical data to improve planning without pretending forecasts are certain.

### Deliverables

- Demand forecast per SKU.
- Reorder forecast based on sales velocity, lead time, and safety stock.
- Cashflow and inventory purchasing forecast.
- Low/base/high scenario planner.
- Anomaly detection.
- Budget allocation suggestions.
- Recommendation outcome tracking.
- Model version and confidence reporting.

### Acceptance gate

- Forecast backtests are recorded against historical periods.
- Recommendations show inputs, confidence, and expiry.
- User can compare predicted and actual outcomes.

---

## 11. Vibe-Coding Protocol

This section is mandatory guidance for any coding agent.

### 11.1 One phase at a time

- Read this file completely before implementation.
- Identify the active phase and its acceptance gate.
- Inspect the repository before creating files.
- Do not implement future-phase features unless required as a minimal interface.
- Keep each task as a small vertical slice that can be demonstrated.
- Preserve existing user changes and avoid unrelated rewrites.

### 11.2 Work loop

For every task:

1. State the intended outcome and files likely affected.
2. Inspect existing code and relevant decisions.
3. Implement the smallest coherent change.
4. Add or update tests and fixtures.
5. Run targeted validation.
6. Run build/lint/typecheck before phase completion.
7. Report what changed, what was verified, and any remaining risk.

### 11.3 Definition of done for every feature

- Happy path works.
- Loading, empty, validation, permission, and failure states exist.
- Domain logic is not embedded in UI components or route handlers.
- External writes are idempotent.
- Financial calculations use decimal-safe logic.
- New data has source and timestamps.
- Sensitive data is not logged.
- Tests cover calculations/state transitions/normalizers as appropriate.
- No unrelated lint, type, or build failures.
- Documentation is updated when behavior or calculation definitions change.

### 11.4 Testing pyramid

- Unit tests: calculations, state machines, scoring, normalization.
- Integration tests: database transactions, idempotent imports, stock ledger, COGS.
- Fixture tests: scraper and connector parsing.
- End-to-end smoke tests: one primary user journey per completed phase.
- Manual controlled live tests: fragile external sources only.

Do not make live external scraping the only test.

### 11.5 Change-control rules

- Do not change financial definitions silently.
- Do not change lifecycle states without migration and compatibility review.
- Do not add a dependency when a current package already solves the need.
- Do not create duplicate models for the same business concept.
- Record important architecture decisions in `docs/decisions/`.
- Keep raw-source parsing inside connector/scraper boundaries.
- Prefer explicit types and state machines over free-form strings.

### 11.6 Data-first demo rule

Every phase must include deterministic seed/fixture data so the UI can be developed and reviewed without a live external account.

Required golden demo:

```text
Meta ad evidence
 -> opportunity
 -> supplier quote
 -> SKU
 -> PO
 -> stock receipt
 -> campaign spend
 -> sales order
 -> return/refund if applicable
 -> contribution profit
 -> recommended action
```

### 11.7 Starter prompt for a coding agent

```text
Read warsneaksplan.md completely and inspect the current repository.

Work only on Phase [N] and only on this vertical slice:
[DESCRIBE THE SLICE].

Before editing, summarize the current implementation and list a short execution plan.
Preserve unrelated user changes. Keep business logic in domain services, validate
all API inputs, make external/import writes idempotent, and add deterministic tests
or fixtures. Do not implement later phases unless a minimal interface is necessary.

Finish by running the relevant tests, typecheck, lint, and build. Report changed
files, verification results, assumptions, and remaining risks. The task is complete
only when the active phase acceptance criteria for this slice are satisfied.
```

---

## 12. MVP Scope

The MVP ends at Phase 4 and must include one complete business loop.

### In MVP

- Single-user workspace.
- Meta Ads scan/import and observation history.
- Opportunity and decision lifecycle.
- SKU, supplier quote, landed cost, PO, goods receipt.
- Stock ledger and inventory balance.
- Campaign plan and manual/CSV ad-spend import.
- Manual/CSV order import.
- Fees, COGS, returns/refunds, revenue, and contribution profit.
- Action Center with explainable rules.
- Executive Command Center.
- CSV export and audit history.

### Not in MVP

- Autonomous purchasing.
- Autonomous campaign launch or budget change.
- Multi-user role matrix.
- Formal accounting/tax filing.
- Multiple marketplace connectors.
- Complex attribution modeling.
- Machine-learning recommendations.
- Permanent archive of every competitor video.
- Full warehouse management.

---

## 13. Product Success Criteria

WarSneaks succeeds when the user can:

1. Discover a market signal from Meta Ads Spy.
2. Save evidence and make a documented decision.
3. Convert the opportunity into an owned SKU.
4. Calculate landed cost and low/base/high expected profit.
5. Create a PO and receive stock.
6. Record/import campaign spend and sales.
7. See actual contribution profit per SKU and campaign.
8. Receive explainable reorder, scale, pause, reprice, or discontinue actions.
9. Trace every KPI to its source transactions.
10. Run the primary business loop without another spreadsheet acting as the main source of truth.

Operational quality targets:

- Repeated imports and syncs do not create duplicates.
- Stock balance always reconciles to stock movements.
- Profit calculations use versioned, tested definitions.
- External-source failures are visible and recoverable.
- Consequential actions always have approval and audit history.

---

## 14. Principal Risks and Mitigations

### Fragile public-source scraping

Mitigation: connector boundaries, fixtures, conservative rate limits, access spike, fallback imports, and last-known-good data.

### False confidence from incomplete data

Mitigation: confidence score, freshness labels, source coverage, low/base/high scenarios, and explicit assumptions.

### Incorrect profit numbers

Mitigation: written definitions, decimal-safe calculations, cost snapshots, reconciliation, fixtures, and traceable drill-down.

### Inventory drift

Mitigation: immutable stock movements, idempotent receipts/orders, reservations, and stock opname.

### Too much scope

Mitigation: Phase 4 vertical-slice MVP, manual/CSV inputs, acceptance gates, and strict deferred scope.

### Unsafe automation

Mitigation: recommendation-first UX, explicit approval, idempotency, least privilege, and audit logs.

### Media storage and content rights

Mitigation: metadata/thumbnail first, configurable retention, object storage, and no automatic mass archival in MVP.

---

## 15. Final Product Decision

Meta Ads Spy adalah pintu masuk market intelligence, bukan keseluruhan produk.

WarSneaks adalah closed-loop Business Command Center:

```text
signal -> decision -> purchase -> stock -> marketing -> sale -> profit -> learning
```

The first implementation goal is not to automate everything. It is to make one complete business loop reliable, traceable, and actionable. Automation and forecasting are added only after actual operating data proves the underlying model.

