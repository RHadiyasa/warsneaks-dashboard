import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeImport, normalizeMetaAd } from "../scripts/normalize-meta-ads.mjs";
import { calculateScenario, sampleInput } from "../scripts/calculate-scenario.mjs";

test("manual import produces normalized ads with stable identities", () => {
  const raw = JSON.parse(fs.readFileSync("fixtures/meta-ads/manual-import.sample.json", "utf8"));
  const first = normalizeImport(raw, "2026-07-18T01:00:00Z");
  const second = normalizeImport(raw, "2026-07-19T01:00:00Z");
  assert.equal(first.length, 2);
  assert.equal(first[0].canonicalKey, second[0].canonicalKey);
  assert.equal(first[0].contentFingerprint, second[0].contentFingerprint);
  assert.notEqual(first[0].observation.observedAt, second[0].observation.observedAt);
});

test("fingerprint is a stable fallback when source ID is absent", () => {
  const ad = { pageName: "Demo Store", body: "Sepatu ringan", headline: "Promo", cta: "Shop Now", destinationUrl: "https://example.invalid/p/1" };
  assert.equal(normalizeMetaAd(ad).canonicalKey, normalizeMetaAd({ ...ad, body: "  Sepatu   ringan " }).canonicalKey);
});

test("sample purchase-to-profit scenario matches hand calculation", () => {
  assert.deepEqual(calculateScenario(sampleInput), {
    netSales: 575000n, cogs: 400000n, grossProfit: 175000n, contributionProfit: 10500n,
    cashIn: 540500n, cashOut: 930000n, netCashflow: -389500n,
  });
});
