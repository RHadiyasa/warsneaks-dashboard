import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { relativeRedirect } from "../apps/web/lib/relative-redirect.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("login uses the glossy responsive authentication shell", () => {
  const page = read("apps/web/app/login/page.tsx");
  const css = read("apps/web/app/globals.css");
  assert.match(page, /auth-shell/);
  assert.match(page, /auth-showcase/);
  assert.match(page, /auth-preview/);
  assert.match(css, /backdrop-filter:blur\(24px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("login UX supports password visibility, loading, and accessible errors", () => {
  const form = read("apps/web/app/login/login-form.tsx");
  assert.match(form, /setShowPassword/);
  assert.match(form, /aria-pressed=/);
  assert.match(form, /setSubmitting\(true\)/);
  assert.match(form, /role="alert"/);
  assert.match(form, /autoComplete="current-password"/);
  assert.match(form, /action="\/api\/auth\/login"/);
});

test("production login never pre-fills or embeds the demo password", () => {
  const page = read("apps/web/app/login/page.tsx");
  const form = read("apps/web/app/login/login-form.tsx");
  assert.doesNotMatch(page + form, /change-me-before-production/);
  assert.doesNotMatch(form, /defaultValue=.*password/i);
});

test("submitting keeps credential fields in the native form payload", () => {
  const form = read("apps/web/app/login/login-form.tsx");
  assert.match(form, /readOnly=\{submitting\}/);
  assert.doesNotMatch(form, /<input[^>]+\sdisabled=\{submitting\}/);
});

test("authentication redirects stay on the browser's current origin", () => {
  const response = relativeRedirect("/login?error=validation");
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/login?error=validation");
  assert.throws(() => relativeRedirect("https://localhost:3004/login"), /application-relative/);

  for (const path of [
    "apps/web/app/api/auth/login/route.ts",
    "apps/web/app/api/auth/logout/route.ts",
    "apps/web/middleware.ts",
  ]) {
    const source = read(path);
    assert.match(source, /relativeRedirect/);
    assert.doesNotMatch(source, /new URL\([^)]*request\.url/);
  }
});
