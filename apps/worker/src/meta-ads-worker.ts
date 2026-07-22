import { Prisma } from "@prisma/client";
import { db } from "@warsneaks/db";
import { analyzeMetaAdsScan, type DuplicateEvidence, type MetaAdsAnalysisAd } from "../../../packages/connectors/src/deepseek";
import { parseManualImport, scanMetaAdsLibrary, type MetaAdsScanResult, type RawMetaAd } from "../../../packages/connectors/src/meta-ads";

type ScanPayload = { scanId: string; keyword: string; country?: string; targetCount?: number };
type InsightPayload = { scanId: string };
const scanTimeoutMs = 180_000;
const staleTimeoutMs = 300_000;
const supportedJobs = ["meta_ads.playwright_scan", "meta_ads.analyze_scan"];

const scanCompletionMessage = (reason: MetaAdsScanResult["stopReason"], resultCount: number, targetCount: number) => {
  if (reason === "target_reached") return `Target ${targetCount} iklan tercapai`;
  if (reason === "user_requested") return "Dihentikan pengguna dan berhasil dirangkum";
  if (reason === "max_scrolls") return `Batas keamanan scroll tercapai; ${resultCount} iklan berhasil dirangkum`;
  if (reason === "rate_limited") return `Meta membatasi pagination sementara; ${resultCount} iklan awal berhasil dirangkum`;
  return `Meta tidak memuat Library ID baru; ${resultCount} iklan berhasil dirangkum`;
};

const creativeKey = (ad: { advertiser: { name: string }; body: string; headline: string | null; cta: string | null }) =>
  [ad.advertiser.name, ad.body, ad.headline || "", ad.cta || ""].map(value => value.trim().replace(/\s+/g, " ").toLowerCase()).join("|");

async function recoverStaleJobs() {
  const staleBefore = new Date(Date.now() - staleTimeoutMs);
  const stale = await db.backgroundJob.findMany({ where: { type: { in: supportedJobs }, status: "running", startedAt: { lt: staleBefore } } });
  for (const job of stale) {
    const payload = job.payload as InsightPayload;
    if (job.type === "meta_ads.analyze_scan") {
      await db.$transaction([
        db.backgroundJob.update({ where: { id: job.id }, data: { status: "failed", errorCode: "WORKER_STALE_TIMEOUT", finishedAt: new Date() } }),
        db.scanInsight.updateMany({ where: { scanId: payload.scanId }, data: { status: "failed", errorCode: "WORKER_STALE_TIMEOUT", errorMessage: "DeepSeek worker exceeded recovery window", finishedAt: new Date() } })
      ]);
      continue;
    }
    const saved = await db.adObservation.count({ where: { scanId: payload.scanId } });
    await db.$transaction([
      db.backgroundJob.update({ where: { id: job.id }, data: { status: saved ? "partial" : "failed", errorCode: "WORKER_STALE_TIMEOUT", finishedAt: new Date() } }),
      db.adScan.update({ where: { id: payload.scanId }, data: { status: saved ? "partial" : "failed", resultCount: saved, discoveredCount: saved, errorCode: "WORKER_STALE_TIMEOUT", errorMessage: "Worker did not finish within the recovery window", finishedAt: new Date() } })
    ]);
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
    groups.set(key, [...(groups.get(key) || []), observation]);
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

async function queueScanAnalysis(workspaceId: string, scanId: string) {
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  await db.$transaction([
    db.scanInsight.upsert({ where: { scanId }, update: { status: "queued", model, errorCode: null, errorMessage: null, startedAt: null, finishedAt: null }, create: { scanId, status: "queued", model } }),
    db.backgroundJob.upsert({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: `meta-ads-insight:${scanId}` } }, update: { status: "queued", errorCode: null, startedAt: null, finishedAt: null, result: Prisma.DbNull }, create: { workspaceId, type: "meta_ads.analyze_scan", status: "queued", idempotencyKey: `meta-ads-insight:${scanId}`, payload: { scanId } } })
  ]);
}

async function processInsightJob(job: { id: string; workspaceId: string; payload: Prisma.JsonValue | null }) {
  const { scanId } = job.payload as InsightPayload;
  try {
    const scan = await db.adScan.findUnique({ where: { id: scanId }, include: { observations: { include: { competitorAd: { include: { advertiser: true } } } } } });
    if (!scan || !scan.observations.length) throw new Error("INSIGHT_EVIDENCE_REQUIRED");
    const grouped = new Map<string, typeof scan.observations>();
    for (const observation of scan.observations) {
      const key = creativeKey(observation.competitorAd);
      grouped.set(key, [...(grouped.get(key) || []), observation]);
    }
    const duplicateGroups: DuplicateEvidence[] = [...grouped.values()].filter(group => group.length > 1).map(group => ({
      clusterName: group[0].competitorAd.headline || group[0].competitorAd.body.slice(0, 100) || "Konten tanpa judul",
      instanceCount: group.length,
      advertiserNames: [...new Set(group.map(item => item.competitorAd.advertiser.name))],
      libraryIds: group.map(item => item.competitorAd.sourceAdId).filter((value): value is string => Boolean(value))
    }));
    const ads: MetaAdsAnalysisAd[] = scan.observations.map(item => ({
      libraryId: item.competitorAd.sourceAdId || item.competitorAd.id,
      advertiser: item.competitorAd.advertiser.name,
      body: item.competitorAd.body.slice(0, 1600),
      headline: item.competitorAd.headline,
      cta: item.competitorAd.cta,
      landingPageUrl: item.competitorAd.landingPageUrl,
      startedRunningAt: item.competitorAd.startedRunningAt?.toISOString() || null,
      duplicateCount: item.duplicateCount || 1
    }));
    const previous = await db.scanInsight.findMany({ where: { status: "succeeded", scanId: { not: scanId } }, include: { scan: true }, orderBy: { createdAt: "desc" }, take: 12 });
    const historicalInsights = previous.filter(item => item.scan.keyword.toLowerCase() === scan.keyword.toLowerCase() && item.scan.country === scan.country).slice(0, 5).map(item => ({ analyzedAt: item.finishedAt?.toISOString(), productTrends: item.productTrends }));
    const analysis = await analyzeMetaAdsScan({
      scan: { id: scan.id, keyword: scan.keyword, country: scan.country, resultCount: scan.resultCount, advertiserCount: scan.advertiserCount, duplicateGroupCount: scan.duplicateGroupCount, highDuplicateCount: scan.highDuplicateCount },
      ads,
      duplicateGroups,
      historicalInsights
    });
    await db.$transaction([
      db.scanInsight.update({ where: { scanId }, data: { status: "succeeded", model: analysis.model, executiveSummary: analysis.insight.executiveSummary, marketVerdict: analysis.insight.marketVerdict, confidence: analysis.insight.confidence, productTrends: analysis.insight.productTrends as Prisma.InputJsonValue, duplicateInsights: analysis.insight.duplicateInsights as Prisma.InputJsonValue, winningAngles: analysis.insight.winningAngles as Prisma.InputJsonValue, recommendations: analysis.insight.recommendations as Prisma.InputJsonValue, risks: analysis.insight.risks as Prisma.InputJsonValue, rawResponse: analysis.raw as Prisma.InputJsonValue, finishedAt: new Date() } }),
      db.backgroundJob.update({ where: { id: job.id }, data: { status: "succeeded", finishedAt: new Date(), result: { confidence: analysis.insight.confidence, products: analysis.insight.productTrends.length } } })
    ]);
    console.log(`Analyzed scan ${scanId} with ${analysis.model}: ${analysis.insight.productTrends.length} product signals`);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "DEEPSEEK_ANALYSIS_FAILED";
    await db.$transaction([
      db.scanInsight.updateMany({ where: { scanId }, data: { status: "failed", errorCode: message.split(":")[0], errorMessage: message.slice(0, 1000), finishedAt: new Date() } }),
      db.backgroundJob.update({ where: { id: job.id }, data: { status: "failed", errorCode: message.split(":")[0], finishedAt: new Date() } })
    ]);
    console.error(`Insight failed for scan ${scanId}: ${message.split(":")[0]}`);
  }
}

async function processScanJob(job: { id: string; workspaceId: string; payload: Prisma.JsonValue | null }) {
  const payload = job.payload as ScanPayload;
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
    const progressMessage = scanCompletionMessage(result.stopReason, summary.resultCount, payload.targetCount || 100);
    await db.$transaction([
      db.adScan.update({ where: { id: payload.scanId }, data: { status: "succeeded", ...summary, discoveredCount: summary.resultCount, progressMessage, finishedAt: new Date() } }),
      db.backgroundJob.update({ where: { id: job.id }, data: { status: "succeeded", finishedAt: new Date(), result: { ...summary, stopReason: result.stopReason } } })
    ]);
    await queueScanAnalysis(job.workspaceId, payload.scanId);
    console.log(`Completed ${job.id}: ${summary.resultCount} ads (${result.stopReason}); DeepSeek analysis queued`);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "SCAN_FAILED";
    const saved = await db.adObservation.count({ where: { scanId: payload.scanId } });
    const summary = saved ? await summarizeScan(payload.scanId) : { resultCount: 0, duplicateAdsCount: 0, duplicateGroupCount: 0, totalInstances: 0, highDuplicateCount: 0, advertiserCount: 0 };
    await db.$transaction([
      db.adScan.update({ where: { id: payload.scanId }, data: { status: saved ? "partial" : "failed", ...summary, discoveredCount: saved, errorCode: message, errorMessage: message, progressMessage: saved ? "Data parsial berhasil dirangkum" : "Scan gagal sebelum data ditemukan", finishedAt: new Date() } }),
      db.backgroundJob.update({ where: { id: job.id }, data: { status: saved ? "partial" : "failed", errorCode: message, finishedAt: new Date(), result: saved ? summary : undefined } })
    ]);
    if (saved) await queueScanAnalysis(job.workspaceId, payload.scanId);
    console.error(`Failed ${job.id}: ${message}; preserved ${saved} ads`);
  }
}

async function processNext() {
  const job = await db.$transaction(async tx => {
    const candidate = await tx.backgroundJob.findFirst({ where: { type: { in: supportedJobs }, status: "queued" }, orderBy: { createdAt: "asc" } });
    if (!candidate) return null;
    const payload = candidate.payload as InsightPayload;
    const scan = await tx.adScan.findUnique({ where: { id: payload.scanId } });
    if (!scan || scan.status === "cancelled") {
      await tx.backgroundJob.update({ where: { id: candidate.id }, data: { status: "cancelled", finishedAt: new Date() } });
      return null;
    }
    const claimed = await tx.backgroundJob.update({ where: { id: candidate.id }, data: { status: "running", attempts: { increment: 1 }, startedAt: new Date() } });
    if (candidate.type === "meta_ads.analyze_scan") {
      await tx.scanInsight.upsert({ where: { scanId: payload.scanId }, update: { status: "running", startedAt: new Date(), errorCode: null, errorMessage: null }, create: { scanId: payload.scanId, status: "running", model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash", startedAt: new Date() } });
    } else {
      await tx.adScan.update({ where: { id: payload.scanId }, data: { status: "collecting", startedAt: new Date(), errorCode: null, errorMessage: null, progressMessage: "Playwright membuka Meta Ads Library" } });
    }
    return claimed;
  });
  if (!job) return false;
  if (job.type === "meta_ads.analyze_scan") await processInsightJob(job);
  else await processScanJob(job);
  return true;
}

async function main() {
  await recoverStaleJobs();
  const once = process.argv.includes("--once");
  if (once) { await processNext(); return; }
  console.log("Meta Ads worker polling scan and DeepSeek jobs every 3 seconds");
  while (true) {
    const worked = await processNext();
    if (!worked) await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

main().catch(reason => { console.error(reason); process.exitCode = 1; }).finally(() => { if (process.argv.includes("--once")) return db.$disconnect(); });
