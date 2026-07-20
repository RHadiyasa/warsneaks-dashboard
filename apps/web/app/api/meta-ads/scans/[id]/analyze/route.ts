import { NextResponse } from "next/server";
import { readSession } from "@web/lib/auth";
import { requestScanAnalysis } from "@web/lib/phase2/service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await readSession()) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  try {
    return NextResponse.json(await requestScanAnalysis((await params).id), { status: 202 });
  } catch (reason) {
    const code = reason instanceof Error ? reason.message : "INSIGHT_REQUEST_FAILED";
    return NextResponse.json({ code }, { status: code === "INSIGHT_EVIDENCE_REQUIRED" ? 409 : 404 });
  }
}