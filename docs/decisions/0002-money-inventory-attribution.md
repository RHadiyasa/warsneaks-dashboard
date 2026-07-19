# ADR 0002: Money, inventory cost, and attribution

Status: Accepted (2026-07-19)

- Store amounts as decimal-safe values with ISO currency; never use binary floating point. Phase 0 uses integer `BigInt` rupiah.
- Inventory truth is an append-only movement ledger. MVP uses weighted-average cost.
- Snapshot unit cost when a sale posts; later quotes or receipts never rewrite historical COGS.
- Store platform-reported and internal attribution separately. Operational profit uses observed orders and explicitly linked spend.
- Revenue means net sales (`gross sales - discounts - refunds`), not cash receipts or platform-reported revenue.

Corrections require compensating records or versioned recalculation rather than silent mutation.
