# Live Meta Ads Local Setup

Live keyword scanning does not use the browser extension. It uses local Chrome, a durable PostgreSQL queue through an SSH tunnel, and the Meta Ads worker.

## Current configuration

- Browser: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Local database endpoint: `127.0.0.1:5433`
- SSH tunnel destination: PostgreSQL `127.0.0.1:5432` on VPS
- Environment secrets: local `.env` and `apps/web/.env.local` (both git-ignored)
- Worker log: `meta-ads-worker.log`

After a computer restart, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-live-local.ps1
npm run dev
```

Then open `http://localhost:3000/meta-ads`, select **Playwright live**, enter a keyword, and click **Jalankan scan**. The background worker polls every three seconds. Refresh/revisit the inbox to see completed results.

Stop local tunnel and worker with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-live-local.ps1
```

## Controlled proof

On 2026-07-19, keyword `sepatu sneakers pria` opened the public Indonesian Meta Ads Library and persisted 25 live ads. No extension or stored Meta credential was used. DOM changes, consent pages, rate limits, and Meta terms remain operational risks; failures are recorded without deleting prior evidence.
## Progress modal

The modal polls the persisted scan and worker job every 1.5 seconds. Closing it while active leaves the durable worker running. A completed `Parfum Wanita` E2E scan persisted 21 unique ads on 2026-07-20. Missing platform/headline fields are displayed as unavailable rather than fabricated.

## Search filters

Live scans open `https://web.facebook.com/ads/library/` with active ads, category `All ads`, the selected region (Indonesia by default), and the keyword entered in the UI. The worker scrapes individual result cards, not the empty search landing page. Region is persisted with each scan for auditability.
## Incremental collection and stopping

Set a target between 10 and 500 in the UI. During collection the modal polls durable PostgreSQL progress every 1.5 seconds and displays collected cards and scroll rounds. **Stop & rangkum** requests a graceful stop: the active batch is saved, the browser is closed, and the worker calculates duplicate and advertiser summaries. A stopped scan is successful when its collected evidence is safely summarized; it is not treated as a destructive cancellation.