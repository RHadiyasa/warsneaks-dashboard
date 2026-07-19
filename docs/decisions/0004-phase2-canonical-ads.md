# ADR 0004: Canonical ads, observations, and worker scans

Status: Accepted (2026-07-19)

Meta Ads Library ID is the preferred stable identity. When absent, WarSneaks hashes normalized advertiser, body, headline, CTA, and landing URL. A `CompetitorAd` is canonical per workspace and key; every scan appends an `AdObservation` tied to an `AdScan`.

Fixture and manual JSON imports may normalize synchronously because they are bounded local inputs. Live Playwright scans are enqueued as durable `BackgroundJob` records and executed only by `apps/worker/src/meta-ads-worker.ts`. A failed or partial run updates its scan/job status and never removes prior canonical ads or observations. Media metadata may be observed, but automatic permanent media archival remains deferred.

Opportunity score `phase2-v1` combines reuse signal, evidence breadth, and field completeness. Missing fields lower confidence. This score is a prioritization aid, not a profitability claim.