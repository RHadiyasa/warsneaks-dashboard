import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

function clean(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

export function contentFingerprint(ad) {
  const stableContent = [ad.advertiserName, ad.body, ad.headline, ad.cta, ad.landingPageUrl]
    .map((value) => clean(value).toLowerCase())
    .join("|");
  return crypto.createHash("sha256").update(stableContent).digest("hex");
}

export function normalizeMetaAd(raw, observedAt = "2026-07-19T00:00:00.000Z") {
  const sourceAdId = clean(raw.libraryId || raw.sourceAdId) || null;
  const ad = {
    source: "meta_ads_library",
    sourceAdId,
    advertiserName: clean(raw.pageName || raw.advertiserName),
    body: clean(raw.body || raw.primaryText),
    headline: clean(raw.headline),
    cta: clean(raw.cta),
    landingPageUrl: clean(raw.destinationUrl || raw.landingPageUrl),
    startedRunningAt: raw.startedRunningAt || null,
  };
  const fingerprint = contentFingerprint(ad);
  return {
    canonicalKey: sourceAdId ? `meta_ads_library:${sourceAdId}` : `meta_ads_library:fingerprint:${fingerprint}`,
    ...ad,
    contentFingerprint: fingerprint,
    observation: {
      observedAt,
      isActive: raw.isActive ?? null,
      platforms: [...new Set(raw.platforms || [])].sort(),
    },
  };
}

export function normalizeImport(input, observedAt) {
  const rows = input?.ads || input?.duplicateAds;
  if (!Array.isArray(rows)) throw new TypeError("Import must contain an ads or duplicateAds array");
  return rows.map((row) => normalizeMetaAd({ ...row, sourceAdId: row.sourceAdId || row.adId, primaryText: row.primaryText || row.adText, headline: row.headline || row.adHeadline, cta: row.cta || row.ctaText, startedRunningAt: row.startedRunningAt || row.startDate || null, platforms: Array.isArray(row.platforms) ? row.platforms : String(row.platforms || "").split(",").map((x) => x.trim()).filter(Boolean) }, observedAt));
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: node scripts/normalize-meta-ads.mjs <import.json>");
  process.stdout.write(`${JSON.stringify(normalizeImport(JSON.parse(fs.readFileSync(path, "utf8"))), null, 2)}\n`);
}

