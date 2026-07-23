import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const extensionPath = path.resolve("spy-meta-ads-library-v2.9.3 (versi Terbaru)");
const profilePath = path.resolve(".tmp-browser-extension-profile");
const dashboardUrl = process.env.EXTENSION_VERIFY_DASHBOARD_URL || "https://warsneaks.ravisa.space/login";
const targetCount = Math.min(500, Math.max(10, Number(process.env.EXTENSION_VERIFY_TARGET_COUNT) || 10));
const verifyTimeoutMs = Math.max(35_000, Number(process.env.EXTENSION_VERIFY_TIMEOUT_MS) || targetCount * 2_000);
if (path.basename(profilePath) !== ".tmp-browser-extension-profile") throw new Error("UNSAFE_PROFILE_PATH");
await fs.rm(profilePath, { recursive: true, force: true });

const context = await chromium.launchPersistentContext(profilePath, {
  headless: process.env.EXTENSION_VERIFY_HEADFUL !== "1",
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  viewport: { width: 1365, height: 900 },
});

try {
  const page = context.pages()[0] || await context.newPage();
  await page.goto(dashboardUrl, { waitUntil: "commit", timeout: 60_000 });
  await page.waitForTimeout(1500);
  const bridgeReady = await page.evaluate(() => new Promise(resolve => {
    const timeout = window.setTimeout(() => { cleanup(); resolve(false); }, 5000);
    const cleanup = () => { window.clearTimeout(timeout); window.removeEventListener("message", handler); };
    const handler = event => {
      if (event.source !== window || event.data?.source !== "warsneaks-extension" || event.data.type !== "WARSNEAKS_EXTENSION_READY") return;
      cleanup();
      resolve(true);
    };
    window.addEventListener("message", handler);
    window.postMessage({ source: "warsneaks-dashboard", type: "WARSNEAKS_EXTENSION_PING" }, window.location.origin);
  }));
  console.log(JSON.stringify({ bridgeReady, serviceWorkers: context.serviceWorkers().map(worker => worker.url()) }));
  if (!bridgeReady) throw new Error("EXTENSION_BRIDGE_NOT_READY");
  let result;
  try {
    result = await page.evaluate(async ({ targetCount, verifyTimeoutMs }) => {
    const requestId = `browser-verify-${crypto.randomUUID()}`;
    const url = "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ID&is_targeted_country=false&media_type=all&q=iphone%2015&search_type=keyword_unordered";
    return new Promise((resolve, reject) => {
      const events = [];
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error(`EXTENSION_VERIFY_TIMEOUT:${JSON.stringify(events.slice(-10))}`)); }, verifyTimeoutMs);
      const cleanup = () => { window.clearTimeout(timeout); window.removeEventListener("message", handler); };
      const handler = event => {
        const message = event.data;
        if (event.source !== window || message?.source !== "warsneaks-extension" || message.requestId !== requestId) return;
        events.push({ type: message.type, count: message.count, scrollCount: message.scrollCount, error: message.error });
        if (message.type === "WARSNEAKS_META_SCAN_COMPLETED") { cleanup(); resolve({ count: message.ads?.length || 0, stopReason: message.stopReason, scrollCount: message.scrollCount }); }
        if (message.type === "WARSNEAKS_META_SCAN_ERROR") { cleanup(); reject(new Error(message.error || "EXTENSION_VERIFY_FAILED")); }
      };
      window.addEventListener("message", handler);
      window.postMessage({ source: "warsneaks-dashboard", type: "WARSNEAKS_START_META_SCAN", requestId, url, targetCount }, window.location.origin);
    });
    }, { targetCount, verifyTimeoutMs });
  } catch (error) {
    const tabs = [];
    for (const openPage of context.pages()) {
      tabs.push({
        url: openPage.url(),
        scannerLoaded: await openPage.evaluate(() => Boolean(window.__warsneaksBrowserScanner)).catch(() => false),
        scannerState: await openPage.evaluate(() => window.__warsneaksBrowserScanner?.getState?.() || null).catch(() => null),
        documentState: await openPage.evaluate(() => ({ readyState: document.readyState, hasBody: Boolean(document.body) })).catch(() => null),
      });
    }
    const worker = context.serviceWorkers()[0];
    const session = worker ? await worker.evaluate(() => chrome.storage.session.get(null)).catch(() => null) : null;
    console.log(JSON.stringify({ tabs, session }));
    throw error;
  }
  console.log(JSON.stringify(result));
  if (!result || result.count < targetCount || result.stopReason !== "target_reached") process.exitCode = 1;
} finally {
  await Promise.race([context.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
  await fs.rm(profilePath, { recursive: true, force: true }).catch(() => {});
}
