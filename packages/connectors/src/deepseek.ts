import { z } from "zod";

const productTrendSchema = z.object({
  product: z.string().min(1).max(120),
  category: z.string().min(1).max(100),
  signal: z.enum(["dominant_current_scan", "emerging", "rising", "stable", "declining"]),
  score: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
  adCount: z.number().int().nonnegative(),
  advertiserCount: z.number().int().nonnegative(),
  why: z.string().min(1).max(600),
  evidenceLibraryIds: z.array(z.string()).max(12)
});

const duplicateInsightSchema = z.object({
  clusterName: z.string().min(1).max(140),
  instanceCount: z.number().int().min(2),
  advertiserNames: z.array(z.string()).max(20),
  interpretation: z.string().min(1).max(500),
  evidenceLibraryIds: z.array(z.string()).max(20)
});

const winningAngleSchema = z.object({
  angle: z.string().min(1).max(140),
  frequency: z.number().int().nonnegative(),
  explanation: z.string().min(1).max(500),
  exampleLibraryIds: z.array(z.string()).max(10)
});

const recommendationSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  action: z.string().min(1).max(220),
  rationale: z.string().min(1).max(600),
  evidence: z.array(z.string()).max(10)
});

const riskSchema = z.object({
  risk: z.string().min(1).max(180),
  explanation: z.string().min(1).max(500)
});

export const metaAdsInsightSchema = z.object({
  executiveSummary: z.string().min(1).max(1800),
  marketVerdict: z.enum(["strong_opportunity", "watch", "insufficient_evidence", "avoid"]),
  confidence: z.number().int().min(0).max(100),
  productTrends: z.array(productTrendSchema).min(1).max(12),
  duplicateInsights: z.array(duplicateInsightSchema).max(12),
  winningAngles: z.array(winningAngleSchema).max(12),
  recommendations: z.array(recommendationSchema).min(1).max(10),
  risks: z.array(riskSchema).max(10)
});

const chunkSchema = z.object({
  products: z.array(z.object({
    product: z.string(),
    category: z.string(),
    adCount: z.number().int().nonnegative(),
    advertiserNames: z.array(z.string()),
    evidenceLibraryIds: z.array(z.string()),
    observation: z.string()
  })).max(20),
  angles: z.array(z.object({ angle: z.string(), frequency: z.number().int().nonnegative(), evidenceLibraryIds: z.array(z.string()) })).max(15),
  offers: z.array(z.string()).max(15),
  risks: z.array(z.string()).max(10)
});

export type MetaAdsInsight = z.infer<typeof metaAdsInsightSchema>;
export type MetaAdsAnalysisAd = {
  libraryId: string;
  advertiser: string;
  body: string;
  headline: string | null;
  cta: string | null;
  landingPageUrl: string | null;
  startedRunningAt: string | null;
  duplicateCount: number;
};
export type DuplicateEvidence = { clusterName: string; instanceCount: number; advertiserNames: string[]; libraryIds: string[] };
export type MetaAdsAnalysisInput = {
  scan: { id: string; keyword: string; country: string; resultCount: number; advertiserCount: number; duplicateGroupCount: number; highDuplicateCount: number };
  ads: MetaAdsAnalysisAd[];
  duplicateGroups: DuplicateEvidence[];
  historicalInsights: unknown[];
};

const cleanJson = (value: string) => value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

async function requestJson<T>(schema: z.ZodType<T>, messages: { role: "system" | "user"; content: string }[]): Promise<{ value: T; raw: unknown; model: string }> {
  let requestMessages = messages;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY_NOT_CONFIGURED");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const endpoint = `${(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model, messages: requestMessages, response_format: { type: "json_object" }, temperature: 0.15, max_tokens: 6000 }),
        signal: controller.signal
      });
      const payload = await response.json() as { choices?: { message?: { content?: string } }[]; error?: { message?: string }; model?: string };
      if (!response.ok) throw new Error(`DEEPSEEK_HTTP_${response.status}:${payload.error?.message || "request failed"}`);
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("DEEPSEEK_EMPTY_RESPONSE");
      const parsed = JSON.parse(cleanJson(content));
      return { value: schema.parse(parsed), raw: parsed, model: payload.model || model };
    } catch (reason) {
      if (reason instanceof z.ZodError) {
        requestMessages = [...requestMessages, { role: "user", content: "Respons sebelumnya tidak sesuai schema. Perbaiki dan kembalikan JSON lengkap saja. Error field: " + JSON.stringify(reason.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }))) }];
      }
      lastError = reason instanceof Error ? reason : new Error("DEEPSEEK_REQUEST_FAILED");
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 800));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("DEEPSEEK_REQUEST_FAILED");
}

export async function analyzeMetaAdsScan(input: MetaAdsAnalysisInput): Promise<{ insight: MetaAdsInsight; raw: unknown; model: string }> {
  const chunks: MetaAdsAnalysisAd[][] = [];
  for (let index = 0; index < input.ads.length; index += 40) chunks.push(input.ads.slice(index, index + 40));
  const chunkAnalyses = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const response = await requestJson(chunkSchema, [
      { role: "system", content: `Anda analis market intelligence e-commerce Indonesia. Gunakan hanya evidence yang diberikan. Kelompokkan variasi nama menjadi produk yang masuk akal. Jangan mengklaim profitabilitas. Jawab JSON valid saja dengan schema tepat: {"products":[{"product":"string","category":"string","adCount":0,"advertiserNames":["string"],"evidenceLibraryIds":["string"],"observation":"string"}],"angles":[{"angle":"string","frequency":0,"evidenceLibraryIds":["string"]}],"offers":["string"],"risks":["string"]}. Semua empat key wajib ada. Jangan mengubah nama field dan jangan gunakan string langsung di array products atau angles.` },
      { role: "user", content: `Analisis batch ${index + 1}/${chunks.length} untuk keyword ${input.scan.keyword}. JSON iklan:\n${JSON.stringify(chunks[index])}` }
    ]);
    chunkAnalyses.push(response.value);
  }

  const finalResponse = await requestJson(metaAdsInsightSchema, [
    { role: "system", content: `Anda senior market intelligence analyst untuk seller Indonesia. Buat kesimpulan yang dapat langsung dipahami tanpa membaca semua iklan. Semua klaim harus ditopang evidence Library ID atau angka input. Jika tidak ada histori pembanding, gunakan signal dominant_current_scan atau emerging; jangan gunakan rising/declining. Jawab JSON valid saja dengan semua key dan bentuk tepat: {"executiveSummary":"string","marketVerdict":"strong_opportunity|watch|insufficient_evidence|avoid","confidence":0,"productTrends":[{"product":"string","category":"string","signal":"dominant_current_scan|emerging|rising|stable|declining","score":0,"confidence":0,"adCount":0,"advertiserCount":0,"why":"string","evidenceLibraryIds":["string"]}],"duplicateInsights":[{"clusterName":"string","instanceCount":2,"advertiserNames":["string"],"interpretation":"string","evidenceLibraryIds":["string"]}],"winningAngles":[{"angle":"string","frequency":0,"explanation":"string","exampleLibraryIds":["string"]}],"recommendations":[{"priority":"high|medium|low","action":"string","rationale":"string","evidence":["string"]}],"risks":[{"risk":"string","explanation":"string"}]}. productTrends dan recommendations minimal satu item. Array lain boleh kosong. Jangan mengubah nama field.` },
    { role: "user", content: `Buat insight final berbahasa Indonesia.\nKonteks scan: ${JSON.stringify(input.scan)}\nRingkasan batch: ${JSON.stringify(chunkAnalyses)}\nGrup duplikat deterministik: ${JSON.stringify(input.duplicateGroups)}\nInsight historis pembanding: ${JSON.stringify(input.historicalInsights)}\nGunakan score/confidence 0-100. productTrends wajib berisi adCount, advertiserCount, why, dan evidenceLibraryIds. duplicateInsights hanya boleh memakai grup deterministik yang tersedia.` }
  ]);
  return { insight: finalResponse.value, raw: { chunkAnalyses, final: finalResponse.raw }, model: finalResponse.model };
}
