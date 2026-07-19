# Meta Ads Library Feasibility Spike

Date: 2026-07-19

## Extension inspection

Extension v2.9.3 was inspected read-only. It needs an open Facebook Ads Library tab, injects DOM extraction, auto-scrolls, parses Indonesian/English labels and Library ID, stores rows locally, and exports `{ exportedAt, totalAds, duplicateAds }`. No extension file was modified.

## Controlled live-scan status

A Playwright live scan is not proven in this workspace: Playwright is not installed and no authorized browser session was supplied. Installing browser automation or reusing a personal session was not assumed. This is a documented feasibility failure, as permitted by the deliverable—not a live-source success claim. Deterministic extension-shaped JSON proves the fallback normalization path.

## Risks and controls

| Risk | Control |
|---|---|
| DOM/label changes | Connector isolation, sanitized fixtures, partial failure reporting |
| Login/checkpoint/session expiry | Never log/store credentials; user-controlled reconnect |
| Rate limits/automation restrictions | Conservative bounded scans, backoff, manual JSON fallback |
| Terms/privacy/copyright/law | Review current Meta terms before production; minimal public metadata; retention/deletion; no mass media archive |
| Missing/duplicate Library ID | Source ID first, deterministic fingerprint fallback, retain observations |
| Partial scan | Preserve last-known-good data and report freshness/counts |

Before Phase 2, obtain legal/terms review and run one controlled scan with a dedicated permitted account/session.
