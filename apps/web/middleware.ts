import { NextResponse, type NextRequest } from "next/server";
import { relativeRedirect } from "@web/lib/relative-redirect";

export function middleware(request: NextRequest) {
  if (!request.cookies.get("warsneaks_session")) {
    const next = encodeURIComponent(request.nextUrl.pathname);
    return relativeRedirect(`/login?next=${next}`, 307);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/meta-ads/:path*"] };
