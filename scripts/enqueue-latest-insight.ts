import { db } from "@warsneaks/db";
import { requestScanAnalysis } from "../apps/web/lib/phase2/service";

const scanId = process.argv.find(value => value.startsWith("--scan="))?.slice(7);
const scan = scanId
  ? await db.adScan.findFirst({ where: { id: scanId, workspaceId: "demo-workspace" } })
  : await db.adScan.findFirst({
      where: { workspaceId: "demo-workspace", status: { in: ["succeeded", "partial"] }, resultCount: { gt: 0 } },
      orderBy: { createdAt: "desc" }
    });

if (!scan) throw new Error("NO_COMPLETED_SCAN_WITH_EVIDENCE");
const queued = await requestScanAnalysis(scan.id);
console.log(JSON.stringify({ scanId: scan.id, keyword: scan.keyword, insightStatus: queued.insight.status, jobStatus: queued.job.status }));
await db.$disconnect();
