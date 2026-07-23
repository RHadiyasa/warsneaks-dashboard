import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getScanProgress, runScan } from "../apps/web/lib/phase2/service";

const extensionRoot = "spy-meta-ads-library-v2.9.3 (versi Terbaru)";

test("visible browser scan is the default and imports extension results automatically", () => {
  const ui = fs.readFileSync("apps/web/components/meta-ads-inbox.tsx", "utf8");
  const route = fs.readFileSync("apps/web/app/api/meta-ads/scans/route.ts", "utf8");
  assert.ok(ui.includes('useState("browser")'));
  assert.ok(ui.includes("WARSNEAKS_START_META_SCAN"));
  assert.ok(ui.includes("WARSNEAKS_META_SCAN_COMPLETED"));
  assert.ok(ui.includes("warsneaks-meta-extension.zip"));
  assert.ok(!ui.includes('<option value="playwright">'));
  assert.ok(route.includes('z.literal("browser")'));
  assert.ok(route.includes("stopReasonSchema"));
  assert.ok(route.includes(".max(500)"));
  assert.ok(fs.statSync("apps/web/public/warsneaks-meta-extension.zip").size > 10_000);
});

test("extension v3 bridges dashboard and visible Facebook tabs", () => {
  const manifest = JSON.parse(fs.readFileSync(`${extensionRoot}/manifest.json`, "utf8"));
  const matches = manifest.content_scripts.flatMap((entry: { matches: string[] }) => entry.matches);
  assert.equal(manifest.version, "3.0.0");
  assert.ok(manifest.permissions.includes("tabs"));
  assert.ok(matches.includes("https://warsneaks.ravisa.space/*"));
  assert.ok(matches.includes("https://www.facebook.com/ads/library/*"));
  assert.ok(matches.includes("https://web.facebook.com/ads/library/*"));
  const scannerEntry = manifest.content_scripts.find((entry: { js: string[] }) => entry.js.includes("warsneaks-scanner.js"));
  assert.equal(scannerEntry.world, "MAIN");
  assert.equal(scannerEntry.run_at, "document_start");
  assert.ok(fs.existsSync(`${extensionRoot}/warsneaks-bridge.js`));
  assert.ok(fs.existsSync(`${extensionRoot}/facebook-bridge.js`));
});

test("extension browser collector paginates, reports progress, and honors the target", () => {
  const background = fs.readFileSync(`${extensionRoot}/background.js`, "utf8");
  const scanner = fs.readFileSync(`${extensionRoot}/warsneaks-scanner.js`, "utf8");
  assert.ok(background.includes("chrome.tabs.create"));
  assert.ok(background.includes("{ ...event, source: 'warsneaks-extension' }"));
  assert.ok(scanner.includes("Lihat lebih banyak|See more"));
  assert.ok(scanner.includes("WARSNEAKS_META_SCAN_PROGRESS"));
  assert.ok(scanner.includes("WARSNEAKS_META_SCAN_COMPLETED"));
  assert.ok(scanner.includes("state.targetCount"));
  assert.ok(scanner.includes("target_reached"));
  assert.ok(scanner.includes("state.progressTimer = setTimeout"));
});

test("browser scan persists visible-tab collection metadata in memory mode", async () => {
  const databaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const scan = await runScan({
      keyword: "browser metadata test",
      country: "ID",
      targetCount: 100,
      method: "browser",
      payload: {
        ads: [{ libraryId: "BROWSER-METADATA-01", pageName: "Browser Store", adText: "Evidence from visible browser" }],
        scrollCount: 7,
        stopReason: "no_new_results",
      },
    });
    assert.equal(scan.resultCount, 1);
    assert.equal(scan.scrollCount, 7);
    assert.equal(scan.stopReason, "no_new_results");
    const progress = await getScanProgress(scan.id);
    assert.equal(progress.stopReason, "no_new_results");
  } finally {
    if (databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = databaseUrl;
  }
});

test("scan schema migration stores browser stop reason", () => {
  const schema = fs.readFileSync("packages/db/prisma/schema.prisma", "utf8");
  const migration = fs.readFileSync("packages/db/prisma/migrations/20260723010000_meta_ads_scan_stop_reason/migration.sql", "utf8");
  const service = fs.readFileSync("apps/web/lib/phase2/service.ts", "utf8");
  assert.ok(schema.includes("stopReason          String?"));
  assert.ok(migration.includes('ADD COLUMN "stopReason" TEXT'));
  assert.ok(service.includes("timeout: 120_000"));
});
