# ADR 0001: Phase 0 boundaries and source ingestion

Status: Accepted (2026-07-19)

The existing extension is a read-only reference. It uses Manifest V3, injects a DOM scanner into an open Ads Library tab, stores rows in `chrome.storage.local`, and exports `duplicateAds` JSON.

Decision: page parsing stays behind a connector boundary; scans append observations instead of overwriting canonical ads. Canonical identity is `source + sourceAdId`, falling back to a SHA-256 fingerprint of normalized advertiser, body, headline, CTA, and landing URL. JSON/manual import is the supported fallback and accepts WarSneaks `ads` or extension `duplicateAds`. No automatic media download is allowed in Phase 0.

Consequence: DOM changes remain isolated. Fingerprint collisions remain possible, so source IDs take precedence and observations/evidence are retained.
