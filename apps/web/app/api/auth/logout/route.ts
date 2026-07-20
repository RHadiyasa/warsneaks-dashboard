import { cookieName } from "@web/lib/auth";
import { relativeRedirect } from "@web/lib/relative-redirect";

export async function POST() {
  const response = relativeRedirect("/login");
  response.cookies.delete(cookieName);
  return response;
}
