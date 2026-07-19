import { NextResponse } from "next/server";
import { readSession } from "@web/lib/auth";
import { requestScanStop } from "@web/lib/phase2/service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await readSession()) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  try {
    return NextResponse.json(await requestScanStop((await params).id), { status: 202 });
  } catch {
    return NextResponse.json({ code: "SCAN_NOT_FOUND" }, { status: 404 });
  }
}