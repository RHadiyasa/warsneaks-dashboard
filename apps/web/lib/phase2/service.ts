import fs from "node:fs/promises";
import path from "node:path";
import { parseManualImport, type MetaAdsScanResult, type NormalizedMetaAd } from "../../../../packages/connectors/src/meta-ads";
import { scoreOpportunity, type CanonicalAd } from "../../../../packages/domain/src/phase2";
import { phase2Memory } from "./memory";

const workspaceId = "demo-workspace";
type ScanMetadata = Pick<MetaAdsScanResult, "scrollCount" | "stopReason">;
const scanStopReasons = new Set<MetaAdsScanResult["stopReason"]>(["target_reached", "user_requested", "no_new_results", "max_scrolls", "rate_limited"]);
const dateOrNull = (value: string | null) => { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
const creativeKey = (ad: { advertiserName: string; body: string; headline: string | null; cta: string | null }) =>
  [ad.advertiserName, ad.body, ad.headline || "", ad.cta || ""].map(value => value.trim().replace(/\s+/g, " ").toLowerCase()).join("|");

const serializeInsight = <T extends { startedAt: Date | null; finishedAt: Date | null; createdAt: Date; updatedAt: Date }>(insight: T | null | undefined) => insight ? { ...insight, startedAt: insight.startedAt?.toISOString() || null, finishedAt: insight.finishedAt?.toISOString() || null, createdAt: insight.createdAt.toISOString(), updatedAt: insight.updatedAt.toISOString() } : null;

async function fixtureRows() {
  const text = await fs.readFile(path.join(process.cwd(), "fixtures/meta-ads/manual-import.sample.json"), "utf8");
  return parseManualImport(JSON.parse(text));
}

function summarizeRows(rows: NormalizedMetaAd[]) {
  const groups = new Map<string, NormalizedMetaAd[]>();
  for (const row of rows) { const key = creativeKey(row); groups.set(key, [...(groups.get(key) || []), row]); }
  const duplicates = [...groups.values()].filter(group => group.length > 1);
  return {
    resultCount: rows.length,
    discoveredCount: rows.length,
    totalInstances: rows.length,
    duplicateAdsCount: duplicates.reduce((sum, group) => sum + group.length, 0),
    duplicateGroupCount: duplicates.length,
    highDuplicateCount: duplicates.filter(group => group.length >= 5).length,
    advertiserCount: new Set(rows.map(row => row.advertiserName)).size
  };
}

const completionMessage = (metadata?: ScanMetadata) => {
  if (metadata?.stopReason === "target_reached") return "Target iklan tercapai dari tab browser";
  if (metadata?.stopReason === "user_requested") return "Dihentikan pengguna dan berhasil dirangkum";
  if (metadata?.stopReason === "max_scrolls") return "Batas keamanan scroll tercapai";
  if (metadata?.stopReason === "rate_limited") return "Meta membatasi pagination sementara";
  if (metadata?.stopReason === "no_new_results") return "Meta tidak memuat Library ID baru";
  return null;
};

function browserMetadata(payload: unknown): ScanMetadata {
  if (!payload || typeof payload !== "object") throw new Error("INVALID_BROWSER_SCAN_METADATA");
  const value = payload as { scrollCount?: unknown; stopReason?: unknown };
  if (!Number.isInteger(value.scrollCount) || Number(value.scrollCount) < 0 || Number(value.scrollCount) > 10_000) throw new Error("INVALID_BROWSER_SCROLL_COUNT");
  if (typeof value.stopReason !== "string" || !scanStopReasons.has(value.stopReason as MetaAdsScanResult["stopReason"])) throw new Error("INVALID_BROWSER_STOP_REASON");
  return { scrollCount: Number(value.scrollCount), stopReason: value.stopReason as MetaAdsScanResult["stopReason"] };
}

async function persistScan(keyword: string, method: string, inputRows: NormalizedMetaAd[], failure?: { code: string; message: string }, country = "ID", targetCount = 100, metadata?: ScanMetadata) {
  const rows = [...new Map(inputRows.map(row => [row.canonicalKey, row])).values()];
  if (!process.env.DATABASE_URL) return phase2Memory.run(keyword, rows, failure?.code, metadata);
  const { db } = await import("@warsneaks/db");
  return db.$transaction(async tx => {
    const scan = await tx.adScan.create({ data: { workspaceId, keyword, country, targetCount, method, status: "running", startedAt: new Date(), scrollCount: metadata?.scrollCount || 0, stopReason: metadata?.stopReason, progressMessage: completionMessage(metadata) } });
    for (const row of rows) {
      const advertiser = await tx.advertiser.upsert({ where: { workspaceId_source_name: { workspaceId, source: row.source, name: row.advertiserName } }, update: { pageUrl: row.advertiserUrl }, create: { workspaceId, source: row.source, name: row.advertiserName, pageUrl: row.advertiserUrl } });
      const ad = await tx.competitorAd.upsert({ where: { workspaceId_canonicalKey: { workspaceId, canonicalKey: row.canonicalKey } }, update: { advertiserId: advertiser.id, body: row.body, headline: row.headline, cta: row.cta, landingPageUrl: row.landingPageUrl }, create: { workspaceId, advertiserId: advertiser.id, source: row.source, sourceAdId: row.sourceAdId, canonicalKey: row.canonicalKey, contentFingerprint: row.contentFingerprint, body: row.body, headline: row.headline, cta: row.cta, landingPageUrl: row.landingPageUrl, startedRunningAt: dateOrNull(row.startedRunningAt) } });
      await tx.adObservation.upsert({ where: { scanId_competitorAdId: { scanId: scan.id, competitorAdId: ad.id } }, update: {}, create: { scanId: scan.id, competitorAdId: ad.id, observedAt: new Date(row.observation.observedAt), isActive: row.observation.isActive, platforms: row.observation.platforms, duplicateCount: row.observation.duplicateCount } });
    }
    return tx.adScan.update({ where: { id: scan.id }, data: { status: failure ? (rows.length ? "partial" : "failed") : "succeeded", ...summarizeRows(rows), scrollCount: metadata?.scrollCount || 0, stopReason: metadata?.stopReason, progressMessage: completionMessage(metadata), errorCode: failure?.code, errorMessage: failure?.message, finishedAt: new Date() } });
  }, { maxWait: 10_000, timeout: 120_000 });
}

export async function runScan(input: { keyword: string; method: "browser" | "fixture" | "manual" | "playwright"; payload?: unknown; country?: string; targetCount?: number }) {
  const targetCount = Math.min(500, Math.max(10, input.targetCount || 100));
  if (input.method === "playwright") {
    if (!process.env.DATABASE_URL) return persistScan(input.keyword, input.method, [], { code: "DATABASE_REQUIRED_FOR_DURABLE_JOB", message: "Live scans require the durable worker" }, input.country || "ID", targetCount);
    const { db } = await import("@warsneaks/db");
    return db.$transaction(async tx => {
      const scan = await tx.adScan.create({ data: { workspaceId, keyword: input.keyword, country: input.country || "ID", targetCount, method: input.method, status: "queued", progressMessage: "Menunggu worker" } });
      await tx.backgroundJob.create({ data: { workspaceId, type: "meta_ads.playwright_scan", status: "queued", idempotencyKey: `meta-ads:${scan.id}`, payload: { scanId: scan.id, keyword: input.keyword, country: input.country || "ID", targetCount } } });
      return scan;
    });
  }
  let rows: NormalizedMetaAd[] = [];
  let metadata: ScanMetadata | undefined;
  try {
    if (input.method === "browser") metadata = browserMetadata(input.payload);
    rows = input.method === "fixture" ? await fixtureRows() : parseManualImport(input.payload);
    if (rows.length > 500) throw new Error("IMPORT_LIMIT_EXCEEDED");
  } catch (error) {
    const message = error instanceof Error ? error.message : "SCAN_FAILED";
    return persistScan(input.keyword, input.method, rows, { code: message, message }, input.country || "ID", targetCount, metadata);
  }
  return persistScan(input.keyword, input.method, rows, undefined, input.country || "ID", targetCount, metadata);
}

export async function getInbox() {
  if (!process.env.DATABASE_URL) return { ads: [...phase2Memory.ads.values()], scans: phase2Memory.scans, opportunities: phase2Memory.opportunities, scanSummary: null, latestInsight: null };
  const { db } = await import("@warsneaks/db");
  const [ads, scans, opportunities] = await Promise.all([
    db.competitorAd.findMany({ where: { workspaceId }, include: { advertiser: true, observations: { orderBy: { observedAt: "desc" } } }, orderBy: { updatedAt: "desc" } }),
    db.adScan.findMany({ where: { workspaceId }, include: { insight: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.opportunity.findMany({ where: { workspaceId }, include: { evidence: true, decisions: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } })
  ]);
  const latest = scans.find(scan => scan.status === "succeeded" || scan.status === "partial");
  let scanSummary = null;
  if (latest) {
    const observations = await db.adObservation.findMany({ where: { scanId: latest.id }, include: { competitorAd: { include: { advertiser: true } } } });
    const grouped = new Map<string, typeof observations>();
    for (const observation of observations) {
      const ad = observation.competitorAd;
      const key = creativeKey({ advertiserName: ad.advertiser.name, body: ad.body, headline: ad.headline, cta: ad.cta });
      grouped.set(key, [...(grouped.get(key) || []), observation]);
    }
    const groups = [...grouped.values()].filter(group => group.length > 1).sort((a, b) => b.length - a.length).slice(0, 20).map(group => ({
      fingerprint: group[0].competitorAd.contentFingerprint,
      advertiserName: group[0].competitorAd.advertiser.name,
      instanceCount: group.length,
      headline: group[0].competitorAd.headline,
      body: group[0].competitorAd.body,
      ads: group.map(item => ({ id: item.competitorAd.id, sourceAdId: item.competitorAd.sourceAdId }))
    }));
    scanSummary = { scanId: latest.id, keyword: latest.keyword, country: latest.country, resultCount: latest.resultCount, duplicateAdsCount: latest.duplicateAdsCount, duplicateGroupCount: latest.duplicateGroupCount, totalInstances: latest.totalInstances, highDuplicateCount: latest.highDuplicateCount, advertiserCount: latest.advertiserCount, groups };
  }
  return {
    ads: ads.map(ad => ({ ...ad, startedRunningAt: ad.startedRunningAt?.toISOString() || null, createdAt: ad.createdAt.toISOString(), updatedAt: ad.updatedAt.toISOString(), observations: ad.observations.map(o => ({ ...o, observedAt: o.observedAt.toISOString(), createdAt: o.createdAt.toISOString() })) })),
    scans: scans.map(s => ({ ...s, stopReason: s.stopReason && scanStopReasons.has(s.stopReason as MetaAdsScanResult["stopReason"]) ? s.stopReason as MetaAdsScanResult["stopReason"] : null, createdAt: s.createdAt.toISOString(), startedAt: s.startedAt?.toISOString() || null, finishedAt: s.finishedAt?.toISOString() || null, stopRequestedAt: s.stopRequestedAt?.toISOString() || null, summaryStartedAt: s.summaryStartedAt?.toISOString() || null, insight: serializeInsight(s.insight) })),
    opportunities: opportunities.map(o => ({ ...o, createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(), decisions: o.decisions.map(d => ({ ...d, createdAt: d.createdAt.toISOString() })) })),
    scanSummary,
    latestInsight: serializeInsight(latest?.insight || null)
  };
}

export async function updateAd(id: string, input: { isWatched?: boolean; tags?: string[]; notes?: string }) {
  if (!process.env.DATABASE_URL) { const ad = phase2Memory.ads.get(id); if (!ad) throw new Error("AD_NOT_FOUND"); Object.assign(ad, input); return ad; }
  const { db } = await import("@warsneaks/db");
  return db.competitorAd.update({ where: { id }, data: input });
}

export async function createOpportunity(input: { name: string; adIds: string[]; reason: string; nextAction: string }) {
  if (!process.env.DATABASE_URL) return phase2Memory.createOpportunity(input);
  const { db } = await import("@warsneaks/db");
  const ads = await db.competitorAd.findMany({ where: { workspaceId, id: { in: input.adIds } }, include: { observations: { orderBy: { observedAt: "asc" } } } });
  if (!ads.length) throw new Error("EVIDENCE_REQUIRED");
  const canonical = ads.map(ad => ({ ...ad, source: "meta_ads_library" as const, startedRunningAt: ad.startedRunningAt?.toISOString() || null, advertiserName: "", advertiserUrl: null, observation: { observedAt: "", isActive: null, platforms: [], duplicateCount: null }, observations: ad.observations.map(o => ({ observedAt: o.observedAt.toISOString(), isActive: o.isActive, platforms: o.platforms, duplicateCount: o.duplicateCount })) })) as unknown as CanonicalAd[];
  const scored = scoreOpportunity(canonical);
  return db.opportunity.create({ data: { workspaceId, name: input.name, status: "watching", score: scored.score, confidence: scored.confidence, scoreVersion: scored.version, nextAction: input.nextAction, assumptions: `Score breakdown: ${JSON.stringify(scored.breakdown)}`, evidence: { create: ads.map(ad => ({ competitorAdId: ad.id, reason: input.reason })) }, decisions: { create: { toStatus: "watching", reason: "Opportunity created from Meta Ads evidence", actorId: "demo-owner" } } }, include: { evidence: true, decisions: true } });
}

export async function updateAdvertiser(id: string, isWatched: boolean) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_REQUIRED");
  const { db } = await import("@warsneaks/db");
  return db.advertiser.update({ where: { id }, data: { isWatched } });
}

export async function requestScanStop(id: string) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_REQUIRED");
  const { db } = await import("@warsneaks/db");
  const scan = await db.adScan.findFirst({ where: { id, workspaceId } });
  if (!scan) throw new Error("SCAN_NOT_FOUND");
  if (["succeeded", "partial", "failed", "cancelled"].includes(scan.status)) return scan;
  return db.adScan.update({ where: { id }, data: { status: "stop_requested", stopRequestedAt: new Date(), progressMessage: "Stop diminta; menyelesaikan batch aktif" } });
}

export async function getScanProgress(id: string) {
  if (!process.env.DATABASE_URL) { const scan = phase2Memory.scans.find(item => item.id === id); if (!scan) throw new Error("SCAN_NOT_FOUND"); return { ...scan, stopReason: scan.stopReason || null, job: null }; }
  const { db } = await import("@warsneaks/db");
  const scan = await db.adScan.findFirst({ where: { id, workspaceId }, include: { insight: true } });
  if (!scan) throw new Error("SCAN_NOT_FOUND");
  const [job, analysisJob] = await Promise.all([
    db.backgroundJob.findFirst({ where: { workspaceId, type: "meta_ads.playwright_scan", payload: { path: ["scanId"], equals: id } }, orderBy: { createdAt: "desc" } }),
    db.backgroundJob.findFirst({ where: { workspaceId, type: "meta_ads.analyze_scan", payload: { path: ["scanId"], equals: id } }, orderBy: { createdAt: "desc" } })
  ]);
  const effectiveStatus = scan.status === "queued" && job?.status === "running" ? "collecting" : scan.status === "queued" && job?.status === "failed" ? "failed" : scan.status;
  const jobResult = job?.result;
  const jobStopReason = jobResult && typeof jobResult === "object" && !Array.isArray(jobResult) && "stopReason" in jobResult && typeof jobResult.stopReason === "string" ? jobResult.stopReason : null;
  const stopReason = scan.stopReason || jobStopReason;
  return { ...scan, stopReason, insight: scan.insight ? { ...scan.insight, startedAt: scan.insight.startedAt?.toISOString() || null, finishedAt: scan.insight.finishedAt?.toISOString() || null, createdAt: scan.insight.createdAt.toISOString(), updatedAt: scan.insight.updatedAt.toISOString() } : null, status: effectiveStatus, errorCode: scan.errorCode || job?.errorCode || null, createdAt: scan.createdAt.toISOString(), startedAt: (scan.startedAt || job?.startedAt)?.toISOString() || null, finishedAt: (scan.finishedAt || job?.finishedAt)?.toISOString() || null, stopRequestedAt: scan.stopRequestedAt?.toISOString() || null, summaryStartedAt: scan.summaryStartedAt?.toISOString() || null, job: job ? { id: job.id, status: job.status, attempts: job.attempts, createdAt: job.createdAt.toISOString(), startedAt: job.startedAt?.toISOString() || null, finishedAt: job.finishedAt?.toISOString() || null, errorCode: job.errorCode } : null, analysisJob: analysisJob ? { id: analysisJob.id, status: analysisJob.status, attempts: analysisJob.attempts, errorCode: analysisJob.errorCode } : null };
}
export async function requestScanAnalysis(id: string) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_REQUIRED");
  const { db } = await import("@warsneaks/db");
  const scan = await db.adScan.findFirst({ where: { id, workspaceId } });
  if (!scan) throw new Error("SCAN_NOT_FOUND");
  if (!["succeeded", "partial"].includes(scan.status) || scan.resultCount < 1) throw new Error("INSIGHT_EVIDENCE_REQUIRED");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  return db.$transaction(async tx => {
    const insight = await tx.scanInsight.upsert({
      where: { scanId: id },
      update: { status: "queued", model, executiveSummary: null, marketVerdict: null, confidence: 0, productTrends: [], duplicateInsights: [], winningAngles: [], recommendations: [], risks: [], rawResponse: {}, errorCode: null, errorMessage: null, startedAt: null, finishedAt: null },
      create: { scanId: id, status: "queued", model }
    });
    const job = await tx.backgroundJob.upsert({
      where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: "meta-ads-insight:" + id } },
      update: { status: "queued", attempts: 0, payload: { scanId: id }, errorCode: null, startedAt: null, finishedAt: null },
      create: { workspaceId, type: "meta_ads.analyze_scan", status: "queued", idempotencyKey: "meta-ads-insight:" + id, payload: { scanId: id } }
    });
    return { insight: serializeInsight(insight), job };
  });
}
