import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { metaAdsInsightSchema } from "../packages/connectors/src/deepseek";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("DeepSeek insight contract accepts evidence-backed market brief", () => {
  const result = metaAdsInsightSchema.parse({
    executiveSummary: "Permintaan terlihat terkonsentrasi pada satu kategori.",
    marketVerdict: "watch",
    confidence: 74,
    productTrends: [{
      product: "Gamis kasual",
      category: "Fashion muslim",
      signal: "dominant_current_scan",
      score: 81,
      confidence: 78,
      adCount: 12,
      advertiserCount: 7,
      why: "Muncul pada beberapa advertiser dalam scan yang sama.",
      evidenceLibraryIds: ["1001", "1002"]
    }],
    duplicateInsights: [],
    winningAngles: [{ angle: "Diskon langsung", frequency: 4, explanation: "Promo harga sering dipakai.", exampleLibraryIds: ["1001"] }],
    recommendations: [{ priority: "high", action: "Validasi penawaran", rationale: "Signal lintas advertiser tersedia.", evidence: ["1001"] }],
    risks: [{ risk: "Bukan data penjualan", explanation: "Frekuensi iklan tidak membuktikan omzet." }]
  });
  assert.equal(result.productTrends[0].signal, "dominant_current_scan");
  assert.equal(result.marketVerdict, "watch");
});

test("DeepSeek insight contract rejects unsupported trend claims", () => {
  assert.throws(() => metaAdsInsightSchema.parse({
    executiveSummary: "Ringkasan",
    marketVerdict: "watch",
    confidence: 50,
    productTrends: [{ product: "Produk", category: "Kategori", signal: "viral", score: 50, confidence: 50, adCount: 1, advertiserCount: 1, why: "Evidence", evidenceLibraryIds: ["1"] }],
    duplicateInsights: [],
    winningAngles: [],
    recommendations: [{ priority: "medium", action: "Pantau", rationale: "Perlu data", evidence: ["1"] }],
    risks: []
  }));
});

test("DeepSeek analysis is durable and insight-first UI keeps raw ads behind a button", () => {
  const migration = read("packages/db/prisma/migrations/20260720020000_phase2_deepseek_insights/migration.sql");
  const worker = read("apps/worker/src/meta-ads-worker.ts");
  const service = read("apps/web/lib/phase2/service.ts");
  const ui = read("apps/web/components/meta-ads-inbox.tsx");
  assert.match(migration, /CREATE TABLE "ScanInsight"/);
  assert.match(worker, /meta_ads\.analyze_scan/);
  assert.match(service, /requestScanAnalysis/);
  assert.match(ui, /DEEPSEEK MARKET BRIEF/);
  assert.match(ui, /Lihat semua iklan/);
  assert.match(ui, /SpotlightCard/);
  assert.match(ui, /CountUp/);
});

test("DeepSeek credentials are read from environment and never embedded in source", () => {
  const connector = read("packages/connectors/src/deepseek.ts");
  assert.match(connector, /process\.env\.DEEPSEEK_API_KEY/);
  assert.match(connector, /thinking: \{ type: "disabled" \}/);
  const sources = [
    connector,
    read("apps/worker/src/meta-ads-worker.ts"),
    read("apps/web/lib/phase2/service.ts"),
    read("apps/web/components/meta-ads-inbox.tsx")
  ].join("\n");
  assert.doesNotMatch(sources, /sk-[a-z0-9]{16,}/i);
});
