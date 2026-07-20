import { z } from "zod";
import { cookieName, createSession, verifyCredentials } from "@web/lib/auth";
import { relativeRedirect } from "@web/lib/relative-redirect";

const input = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(request: Request) {
  const form = Object.fromEntries(await request.formData());
  const parsed = input.safeParse(form);

  if (!parsed.success) return relativeRedirect("/login?error=validation");

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) return relativeRedirect("/login?error=credentials");

  const response = relativeRedirect("/dashboard");
  response.cookies.set(cookieName, await createSession(user.userId, user.workspaceId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 28800,
  });
  return response;
}
