import { db } from "@warsneaks/db";
import { parseManualImport, scanMetaAdsLibrary, type RawMetaAd } from "../../../packages/connectors/src/meta-ads";

type Payload = { scanId: string; keyword: string; country?: string; targetCount?: number };
const scanTimeoutMs = 180_000;
const staleTimeoutMs = 300_000;

const creativeKey = (ad: { advertiser: { name: string }; body: string; headline: string | null; cta: string | null }) =>
  [ad.advertiser.name, ad.body, ad.headline || "", ad.cta || ""].map(value => value.trim().replace(/\s+/g, " ").toLowerCase()).join("|");

async function recoverStaleJobs() {
  const staleBefore = new Date(Date.now() - staleTimeoutMs);
  const stale = await db.backgroundJob.findMany({ where: { type: "meta_ads.playwright_scan", status: "running", startedAt: { lt: staleBefore } } });
  for (const job of stale) {
    const payload = job.payload as Payload;
    const saved = await db.adObservation.count({ where: { scanId: payload.scanId } });
    await db.$transaction([
      db.backgroundJob.update({ where: { id: job.id }, data: { status: saved ? "partial" : "failed", errorCode: "WORKER_STALE_TIMEOUT", finishedAt: new Date() } }),
      db.adScan.update({ where: { id: payload.scanId }, data: { status: saved ? "partial" : "failed", resultCount: saved, discoveredCount: saved, errorCode: "WORKER_STALE_TIMEOUT", errorMessage: "Worker did not finish within the recovery window", finishedAt: new Date() } })
    ]);
    console.error(`Recovered stale job ${job.id}`);
  }
}

async function persistBatch(workspaceId: string, scanId: string, rawAds: RawMetaAd[], discoveredCount: number, scrollCount: number) {
  const normalized = rawAds.map(row => parseManualImport({ ads: [row] })[0]);
  const rows = [...new Map(normalized.map(row => [row.canonicalKey, row])).values()];
  await db.$transaction(async tx => {
    for (const row of rows) {
      const advertiser = await tx.advertiser.upsert({
        where: { workspaceId_source_name: { workspaceId, source: row.source, name: row.advertiserName } },
        update: { pageUrl: row.advertiserUrl },
        create: { workspaceId, source: row.source, name: row.advertiserName, pageUrl: row.advertiserUrl }
      });
      const ad = await tx.competitorAd.upsert({
        where: { workspaceId_canonicalKey: { workspaceId, canonicalKey: row.canonicalKey } },
        update: { advertiserId: advertiser.id, body: row.body, headline: row.headline, cta: row.cta, landingPageUrl: row.landingPageUrl, contentFingerprint: row.contentFingerprint },
        create: { workspaceId, advertiserId: advertiser.id, source: row.source, sourceAdId: row.sourceAdId, canonicalKey: row.canonicalKey, contentFingerprint: row.contentFingerprint, body: row.body, headline: row.headline, cta: row.cta, landingPageUrl: row.landingPageUrl }
      });
      await tx.adObservation.upsert({
        where: { scanId_competitorAdId: { scanId, competitorAdId: ad.id } },
        update: { observedAt: new Date(row.observation.observedAt), isActive: row.observation.isActive, platforms: row.observation.platforms, duplicateCount: row.observation.duplicateCount },
        create: { scanId, competitorAdId: ad.id, observedAt: new Date(row.observation.observedAt), isActive: row.observation.isActive, platforms: row.observation.platforms, duplicateCount: row.observation.duplicateCount }
      });
    }
    await tx.adScan.update({ where: { id: scanId }, data: { discoveredCount, scrollCount, progressMessage: `${discoveredCount} iklan terkumpul · scroll ${scrollCount}` } });
  }, { maxWait: 10_000, timeout: 60_000 });
}

async function summarizeScan(scanId: string) {
  const observations = await db.adObservation.findMany({ where: { scanId }, include: { competitorAd: { include: { advertiser: true } } } });
  const groups = new Map<string, typeof observations>();
  for (const observation of observations) {
    const key = creativeKey(observation.competitorAd);
    const group = groups.get(key) || [];
    group.push(observation);
    groups.set(key, group);
  }
  const duplicateGroups = [...groups.values()].filter(group => group.length > 1);
  for (const group of groups.values()) {
    await db.adObservation.updateMany({ where: { scanId, competitorAdId: { in: group.map(item => item.competitorAdId) } }, data: { duplicateCount: group.length } });
  }
  return {
    resultCount: observations.length,
    duplicateAdsCount: duplicateGroups.reduce((total, group) => total + group.length, 0),
    duplicateGroupCount: duplicateGroups.length,
    totalInstances: observations.length,
    highDuplicateCount: duplicateGroups.filter(group => group.length >= 5).length,
    advertiserCount: new Set(observations.map(item => item.competitorAd.advertiserId)).size
  };
}

async function processNext() {
  const job = await db.$transaction(async tx => {
    const candidate = await tx.backgroundJob.findFirst({ where: { type: "meta_ads.playwright_scan", status: "queued" }, orderBy: { createdAt: "asc" } });
    if (!candidate) return null;
    const payload = candidate.payload as Payload;
    const scan = await tx.adScan.findUnique({ where: { id: payload.scanId } });
    if (!scan || scan.status === "cancelled") {
      await tx.backgroundJob.update({ where: { id: candidate.id }, data: { status: "cancelled", finishedAt: new Date() } });
      return null;
    }
    const claimed = await tx.backgroundJob.update({ where: { id: candidate.id }, data: { status: "running", attempts: { increment: 1 }, startedAt: new Date() } });
    await tx.adScan.update({ where: { id: payload.scanId }, data: { status: "collecting", startedAt: new Date(), errorCode: null, errorMessage: null, progressMessage: "Playwright membuka Meta Ads Library" } });
    return claimed;
  });
  if (!job) return false;
  const payload = job.payload as Payload;
  const deadline = Date.now() + scanTimeoutMs;
  try {
    const result = await scanMetaAdsLibrary(payload.keyword, payload.country || "ID", {
      targetCount: payload.targetCount || 100,
      shouldStop: async () => {
        if (Date.now() > deadline) throw new Error("PLAYWRIGHT_SCAN_TIMEOUT");
        const scan = await db.adScan.findUnique({ where: { id: payload.scanId }, select: { stopRequestedAt: true, status: true } });
        return Boolean(scan?.stopRequestedAt || scan?.status === "stop_requested");
      },
      onProgress: progress => persistBatch(job.workspaceId, payload.scanId, progress.newAds, progress.discoveredCount, progress.scrollCount)
    });
    await db.adScan.update({ where: { id: payload.scanId }, data: { status: "summarizing", summaryStartedAt: new Date(), scrollCount: result.scrollCount, progressMessage: `Mengelompokkan ${result.ads.length} iklan` } });
    const summary = await summarizeScan(payload.scanId);
    await db.$transaction([
      db.adScan.update({ where: { id: payload.scanId }, data: { status: "succeeded", ...summary, discoveredCount: summary.resultCount, progressMessage: result.stopReason === "user_requested" ? "Dihentikan pengguna dan berhasil dirangkum" : "Pengumpulan dan rangkuman selesai", finishedAt: new Date() } }),
      db.backgroundJob.update({ where: { id: job.id }, data: { status: "succeeded", finishedAt: new Date(), result: { ...summary, stopReason: result.stopReason } } })
    ]);
    console.log(`Completed ${job.id}: ${summary.resultCount} ads, ${summary.duplicateGroupCount} duplicate groups (${result.stopReason})`);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "SCAN_FAILED";
    const saved = await db.adObservation.count({ where: { scanId: payload.scanId } });
    const summary = saved ? await summarizeScan(payload.scanId) : { resultCount: 0, duplicateAdsCount: 0, duplicateGroupCount: 0, totalInstances: 0, highDuplicateCount: 0, advertiserCount: 0 };
    await db.$transaction([
      db.adScan.update({ where: { id: payload.scanId }, data: { status: saved ? "partial" : "failed", ...summary, discoveredCount: saved, errorCode: message, errorMessage: message, progressMessage: saved ? "Data parsial berhasil dirangkum" : "Scan gagal sebelum data ditemukan", finishedAt: new Date() } }),
      db.backgroundJob.update({ where: { id: job.id }, data: { status: saved ? "partial" : "failed", errorCode: message, finishedAt: new Date(), result: saved ? summary : undefined } })
    ]);
    console.error(`Failed ${job.id}: ${message}; preserved ${saved} ads`);
  }
  return true;
}

async function main() {
  await recoverStaleJobs();
  const once = process.argv.includes("--once");
  if (once) { await processNext(); return; }
  console.log("Meta Ads worker polling every 3 seconds");
  while (true) {
    const worked = await processNext();
    if (!worked) await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

main().catch(reason => { console.error(reason); process.exitCode = 1; }).finally(() => { if (process.argv.includes("--once")) return db.$disconnect(); });