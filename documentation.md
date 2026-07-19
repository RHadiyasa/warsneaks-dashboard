# WarSneaks Implementation Documentation

## Phase 0 — Feasibility and Domain Decisions

1. **Existing extension inspected — completed 2026-07-19.** Manifest V3 extension v2.9.3 was reviewed without edits. Its DOM scan, storage, Library-ID parsing, and `duplicateAds` export informed ADR 0001.
2. **Meta Ads live-scan feasibility assessed — completed as documented failure.** Playwright and an authorized session are absent, so no live result is claimed. Preconditions and risks are in `docs/meta-ads-feasibility.md`.
3. **Extension JSON/manual fallback — completed.** `scripts/normalize-meta-ads.mjs` accepts `{ ads }` and extension `{ duplicateAds }`, returning canonical ads and per-run observations.
4. **Sanitized fixtures — completed.** Fictional fixtures cover ads, orders, stock, spend, fees, and refunds. Domains use `.invalid`.
5. **Financial/attribution definitions — completed.** ADR 0002 and `docs/calculations.md` lock revenue, COGS, contribution profit, weighted-average inventory cost, cashflow separation, and attribution.
6. **Architecture decisions — completed.** Two ADRs cover ingestion identity and money/inventory/attribution.
7. **Data dictionary/calculation specification — completed.** The hand scenario has executable BigInt proof and regression tests.
8. **Acceptance evidence — completed.** One keyword yields stable normalized IDs; a repeated import maps to the same canonical ad but a different observation; contribution profit is IDR 10,500 and net cashflow IDR -389,500; access/legal/rate/session risks are documented.

Validation: `npm test` and `npm run phase0:normalize`.
