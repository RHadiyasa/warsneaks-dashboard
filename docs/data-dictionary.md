# Phase 0 Data Dictionary

External records carry `source`, `externalId` when available, event/source timestamps, ingestion timestamp, amount currency, and import schema version.

| Concept | Required fields | Meaning |
|---|---|---|
| CompetitorAd | source, sourceAdId nullable, contentFingerprint, advertiserName, body | Canonical public ad identity |
| AdObservation | canonicalKey, observedAt, isActive, platforms | Facts seen during one scan/import |
| Order | externalId, orderedAt, currency, grossSales, discounts | Internal sale header |
| OrderLine | order ID, SKU, quantity, unitPrice, unitCostSnapshot | Sale and immutable COGS input |
| StockMovement | externalId, type, SKU, quantity, occurredAt | Signed inventory ledger entry |
| AdSpend | externalId, campaign, amount, date, attribution | Campaign cost |
| Fee | order ID, type, amount, currency | Marketplace/payment/shipping/affiliate deduction |
| Refund | externalId, order ID, amount, returnLoss, occurredAt | Refund and separate operational loss |

JSON money values are strings for exact interchange. Timestamps use ISO 8601 UTC; reports default to `Asia/Jakarta`.
