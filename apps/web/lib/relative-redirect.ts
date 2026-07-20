import { NextResponse } from "next/server";

type RedirectStatus = 303 | 307;

export function relativeRedirect(location: string, status: RedirectStatus = 303) {
  if (!location.startsWith("/") || location.startsWith("//")) {
    throw new Error("Redirect location must be an application-relative path");
  }

  return new NextResponse(null, {
    status,
    headers: { location },
  });
}
