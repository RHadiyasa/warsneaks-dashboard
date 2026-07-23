import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@web/lib/auth";
import { getInbox, runScan } from "@web/lib/phase2/service";

const shortText = z.string().max(300);
const longText = z.string().max(5_000);
const browserAdSchema = z.object({
  libraryId: z.string().trim().min(1).max(100),
  adId: z.string().max(100).optional(),
  pageName: shortText.optional(),
  advertiserName: shortText.optional(),
  advertiserUrl: z.string().max(2_048).optional(),
  body: longText.optional(),
  primaryText: longText.optional(),
  adText: longText.optional(),
  headline: shortText.optional(),
  adHeadline: shortText.optional(),
  cta: shortText.optional(),
  ctaText: shortText.optional(),
  destinationUrl: z.string().max(2_048).optional(),
  landingPageUrl: z.string().max(2_048).optional(),
  startedRunningAt: shortText.optional(),
  startDate: shortText.optional(),
  isActive: z.boolean().optional(),
  platforms: z.union([z.array(shortText).max(10), z.string().max(500)]).optional(),
  duplicateCount: z.number().int().min(0).max(1_000_000).optional(),
});
const stopReasonSchema = z.enum(["target_reached", "user_requested", "no_new_results", "max_scrolls", "rate_limited"]);
const baseSchema = z.object({
  keyword: z.string().trim().min(2).max(100),
  country: z.string().regex(/^[A-Z]{2}$/).default("ID"),
  targetCount: z.number().int().min(10).max(500).default(100),
});
const schema = z.discriminatedUnion("method", [
  baseSchema.extend({
    method: z.literal("browser"),
    payload: z.object({
      ads: z.array(browserAdSchema).min(1).max(500),
      scrollCount: z.number().int().min(0).max(10_000),
      stopReason: stopReasonSchema,
    }),
  }),
  baseSchema.extend({ method: z.literal("fixture"), payload: z.unknown().optional() }),
  baseSchema.extend({ method: z.literal("manual"), payload: z.unknown() }),
  baseSchema.extend({ method: z.literal("playwright"), payload: z.unknown().optional() }),
]);

export async function GET() {
  if (!await readSession()) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  return NextResponse.json(await getInbox());
}

export async function POST(request: Request) {
  if (!await readSession()) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ code: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  const scan = await runScan(parsed.data);
  return NextResponse.json(scan, { status: 202 });
}
