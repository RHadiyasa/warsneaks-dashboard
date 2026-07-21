import { NextResponse, type NextRequest } from "next/server";

function applicationOrigin(request: NextRequest) {
  return new URL(process.env.APP_ORIGIN || request.nextUrl.origin).origin;
}

export function middleware(request: NextRequest) {
  if (!request.cookies.get("warsneaks_session")) {
    const login = new URL("/login", applicationOrigin(request));
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/meta-ads/:path*"] };
