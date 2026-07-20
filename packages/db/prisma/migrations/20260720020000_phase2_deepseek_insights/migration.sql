CREATE TYPE "InsightStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

CREATE TABLE "ScanInsight" (
  "id" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "status" "InsightStatus" NOT NULL DEFAULT 'queued',
  "model" TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
  "schemaVersion" TEXT NOT NULL DEFAULT 'meta-insight-v1',
  "executiveSummary" TEXT,
  "marketVerdict" TEXT,
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "productTrends" JSONB,
  "duplicateInsights" JSONB,
  "winningAngles" JSONB,
  "recommendations" JSONB,
  "risks" JSONB,
  "rawResponse" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScanInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScanInsight_scanId_key" ON "ScanInsight"("scanId");
CREATE INDEX "ScanInsight_status_createdAt_idx" ON "ScanInsight"("status", "createdAt");
ALTER TABLE "ScanInsight" ADD CONSTRAINT "ScanInsight_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "AdScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;