import { createHash } from "node:crypto";import { chromium } from "playwright-core";
export interface RawMetaAd {libraryId?:string;adId?:string;sourceAdId?:string;pageName?:string;advertiserName?:string;advertiserUrl?:string;body?:string;primaryText?:string;adText?:string;headline?:string;adHeadline?:string;cta?:string;ctaText?:string;destinationUrl?:string;landingPageUrl?:string;startedRunningAt?:string;startDate?:string;isActive?:boolean;platforms?:string[]|string;duplicateCount?:number}
export interface NormalizedMetaAd {canonicalKey:string;source:"meta_ads_library";sourceAdId:string|null;advertiserName:string;advertiserUrl:string|null;body:string;headline:string|null;cta:string|null;landingPageUrl:string|null;startedRunningAt:string|null;contentFingerprint:string;observation:{observedAt:string;isActive:boolean|null;platforms:string[];duplicateCount:number|null}}
const clean=(value:unknown)=>String(value??"").trim().replace(/\s+/g," ");
export function fingerprint(ad:Pick<NormalizedMetaAd,"advertiserName"|"body"|"headline"|"cta"|"landingPageUrl">){return createHash("sha256").update([ad.advertiserName,ad.body,ad.headline,ad.cta,ad.landingPageUrl].map(x=>clean(x).toLowerCase()).join("|")).digest("hex")}
export function normalizeMetaAd(raw:RawMetaAd,observedAt=new Date().toISOString()):NormalizedMetaAd{const sourceAdId=clean(raw.libraryId||raw.adId||raw.sourceAdId)||null;const platforms=Array.isArray(raw.platforms)?raw.platforms:String(raw.platforms||"").split(",");const ad={source:"meta_ads_library" as const,sourceAdId,advertiserName:clean(raw.pageName||raw.advertiserName)||"Unknown advertiser",advertiserUrl:clean(raw.advertiserUrl)||null,body:clean(raw.body||raw.primaryText||raw.adText),headline:clean(raw.headline||raw.adHeadline)||null,cta:clean(raw.cta||raw.ctaText)||null,landingPageUrl:clean(raw.destinationUrl||raw.landingPageUrl)||null,startedRunningAt:raw.startedRunningAt||null};const contentFingerprint=fingerprint(ad);return {...ad,canonicalKey:sourceAdId?`meta_ads_library:${sourceAdId}`:`meta_ads_library:fingerprint:${contentFingerprint}`,contentFingerprint,observation:{observedAt,isActive:raw.isActive??null,platforms:[...new Set(platforms.map(clean).filter(Boolean))].sort(),duplicateCount:Number.isFinite(raw.duplicateCount)?raw.duplicateCount!:null}}}
export function parseManualImport(input:unknown,observedAt?:string){if(!input||typeof input!=="object")throw new Error("INVALID_IMPORT");const envelope=input as {ads?:RawMetaAd[];duplicateAds?:RawMetaAd[]};const rows=envelope.ads||envelope.duplicateAds;if(!Array.isArray(rows))throw new Error("IMPORT_ADS_REQUIRED");return rows.map(row=>normalizeMetaAd(row,observedAt))}
export function buildMetaAdsLibraryUrl(keyword:string,country="ID"){const params=new URLSearchParams({active_status:"active",ad_type:"all",country:country.toUpperCase(),is_targeted_country:"false",media_type:"all",q:keyword,search_type:"keyword_unordered","sort_data[mode]":"total_impressions","sort_data[direction]":"desc"});return `https://www.facebook.com/ads/library/?${params.toString()}`}
export interface MetaAdsScanProgress {
  discoveredCount: number;
  scrollCount: number;
  newAds: RawMetaAd[];
}

export interface MetaAdsScanOptions {
  targetCount?: number;
  maxScrolls?: number;
  stableRounds?: number;
  scrollDelayMs?: number;
  resultWaitMs?: number;
  shouldStop?: () => Promise<boolean>;
  onProgress?: (progress: MetaAdsScanProgress) => Promise<void>;
}

export interface MetaAdsScanResult {
  ads: RawMetaAd[];
  scrollCount: number;
  stopReason: "target_reached" | "user_requested" | "no_new_results" | "max_scrolls" | "rate_limited";
}

export function extractMetaAdLibraryIds(text: string) {
  return [...new Set([...text.matchAll(/(?:Library ID|ID Galeri):\s*(\d+)/gi)].map(match => match[1]))];
}

export function isMetaAdsRateLimitedResponse(body: string) {
  return /"code"\s*:\s*1675004\b|rate limit exceeded/i.test(body);
}

async function extractVisibleMetaAds(page: import("playwright-core").Page): Promise<RawMetaAd[]> {
  const idNodes = page.getByText(/(?:Library ID|ID Galeri):\s*\d+/i);
  return idNodes.evaluateAll(nodes => nodes.map(node => {
    let card = node.parentElement;
    while (card) {
      const candidateText = card.innerText || card.textContent || "";
      const ids = candidateText.match(/(?:Library ID|ID Galeri):\s*\d+/gi) || [];
      if (/Lihat Detail Iklan|See ad details/i.test(candidateText) && ids.length === 1) break;
      card = card.parentElement;
    }
    const text = (card?.innerText || card?.textContent || "").replace(/\u200b/g, "").trim();
    const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const detailIndex = lines.findIndex(line => /Lihat Detail Iklan|See ad details/i.test(line));
    const sponsorIndex = lines.findIndex((line, index) => index > detailIndex && /^(Bersponsor|Sponsored)$/i.test(line));
    const advertiserName = detailIndex >= 0 ? lines[detailIndex + 1] : undefined;
    const contentStart = sponsorIndex >= 0 ? sponsorIndex + 1 : detailIndex + 2;
    const links = [...(card?.querySelectorAll<HTMLAnchorElement>("a[href]") || [])];
    const destinationLink = links.find(link => {
      try {
        const parsed = new URL(link.href);
        return (parsed.hostname === "l.facebook.com" && Boolean(parsed.searchParams.get("u"))) || (!parsed.hostname.includes("facebook.com") && !parsed.hostname.includes("fb.com"));
      } catch { return false; }
    });
    let landing: string | undefined;
    if (destinationLink) {
      try {
        const parsed = new URL(destinationLink.href);
        landing = parsed.hostname === "l.facebook.com" ? parsed.searchParams.get("u") || undefined : parsed.href;
      } catch { landing = undefined; }
    }
    const linkLines = (destinationLink?.innerText || destinationLink?.textContent || "").split(/\n+/).map(line => line.trim()).filter(Boolean);
    const ctaPattern = /^(Shop Now|Pesan sekarang|Belanja Sekarang|Learn More|Pelajari Selengkapnya|Daftar|Sign Up)$/i;
    const noisePattern = /^(?:[A-Z0-9-]+\.)+[A-Z]{2,}$|^(?:IDR|Rp)\s?[\d.,]+|terjual|^[⭐★]+$/i;
    const headline = linkLines.find(line => !ctaPattern.test(line) && !noisePattern.test(line) && line.length > 2);
    const cta = linkLines.find(line => ctaPattern.test(line));
    const contentLines = lines.slice(contentStart);
    const linkStart = linkLines.length ? contentLines.findIndex(line => line === linkLines[0]) : -1;
    const bodyLines = linkStart >= 0 ? contentLines.slice(0, linkStart) : contentLines;
    return {
      libraryId: text.match(/(?:Library ID|ID Galeri):\s*(\d+)/i)?.[1],
      pageName: advertiserName,
      advertiserUrl: links.map(link => link.href).find(href => href.includes("facebook.com") && !href.includes("/l.php")),
      adText: bodyLines.join("\n").slice(0, 3000),
      adHeadline: headline,
      ctaText: cta,
      startedRunningAt: text.match(/(?:Mulai dijalankan pada|Started running on)\s+([^\n]+)/i)?.[1],
      landingPageUrl: landing,
      isActive: /\b(?:Aktif|Active)\b/i.test(text),
      platforms: [],
      duplicateCount: /beberapa versi|multiple versions/i.test(text) ? 2 : 1
    } satisfies RawMetaAd;
  }));
}

async function readMetaAdLibraryIds(page: import("playwright-core").Page) {
  const texts = await page.getByText(/(?:Library ID|ID Galeri):\s*\d+/i).allTextContents();
  return new Set(extractMetaAdLibraryIds(texts.join("\n")));
}

async function loadMoreMetaAds(page: import("playwright-core").Page, knownIds: Set<string>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let nextNudgeAt = Date.now() + 1000;
  const loadMore = page.getByRole("button", { name: /^(?:Lihat lebih banyak|See more)$/i }).last();
  if (await loadMore.count()) {
    const paginationResponse = page.waitForResponse(response =>
      response.url().includes("/api/graphql/") &&
      response.request().postData()?.includes("AdLibrarySearchPaginationQuery") === true,
    { timeout: Math.min(5000, timeoutMs) }).catch(() => undefined);
    const clicked = await loadMore.click({ timeout: 3000 }).then(() => true).catch(() => false);
    if (clicked) {
      const response = await paginationResponse;
      const body = await response?.text().catch(() => "");
      if (body && isMetaAdsRateLimitedResponse(body)) return "rate_limited" as const;
    }
  }
  while (Date.now() < deadline) {
    await page.waitForTimeout(Math.min(500, Math.max(1, deadline - Date.now())));
    const ids = await readMetaAdLibraryIds(page);
    if ([...ids].some(id => !knownIds.has(id))) return "new_results" as const;
    if (Date.now() >= nextNudgeAt) {
      await page.evaluate(() => window.scrollTo(0, document.scrollingElement?.scrollHeight || document.body.scrollHeight));
      await page.mouse.wheel(0, 1200);
      nextNudgeAt = Date.now() + 1000;
    }
  }
  return "no_new_results" as const;
}

export async function scanMetaAdsLibrary(keyword: string, country = "ID", options: MetaAdsScanOptions = {}): Promise<MetaAdsScanResult> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (!executablePath) throw new Error("PLAYWRIGHT_BROWSER_NOT_CONFIGURED");
  const targetCount = Math.min(500, Math.max(10, options.targetCount ?? 100));
  const maxScrolls = Math.min(200, Math.max(1, options.maxScrolls ?? 80));
  const stableLimit = Math.min(10, Math.max(2, options.stableRounds ?? 5));
  const scrollDelayMs = Math.min(5000, Math.max(500, options.scrollDelayMs ?? 1400));
  const resultWaitMs = Math.min(15_000, Math.max(2_000, options.resultWaitMs ?? Math.max(6_000, scrollDelayMs)));
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ locale: "id-ID", viewport: { width: 1440, height: 1100 } });
    await page.goto(buildMetaAdsLibraryUrl(keyword, country), { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(2000);
    if (/login|checkpoint/i.test(page.url())) throw new Error("META_ACCESS_REQUIRED");
    const idNodes = page.getByText(/(?:Library ID|ID Galeri):\s*\d+/i);
    await idNodes.first().waitFor({ state: "attached", timeout: 20_000 }).catch(() => undefined);
    if (!(await idNodes.count())) {
      const body = (await page.locator("body").innerText()).slice(0, 5000);
      if (/(?:~|sekitar)?\s*0\s+(?:hasil|results)/i.test(body)) return { ads: [], scrollCount: 0, stopReason: "no_new_results" };
      throw new Error("META_DOM_SELECTOR_CHANGED_OR_ACCESS_REQUIRED");
    }

    const collected = new Map<string, RawMetaAd>();
    let scrollCount = 0;
    let unchangedRounds = 0;
    let stopReason: MetaAdsScanResult["stopReason"] = "max_scrolls";
    while (true) {
      if (collected.size > 0 && await options.shouldStop?.()) { stopReason = "user_requested"; break; }
      const visible = await extractVisibleMetaAds(page);
      const newAds: RawMetaAd[] = [];
      for (const ad of visible) {
        const key = ad.libraryId || ad.sourceAdId || `${ad.pageName || ""}|${ad.adText || ""}|${ad.adHeadline || ""}`;
        if (!key || collected.has(key)) continue;
        collected.set(key, ad);
        newAds.push(ad);
        if (collected.size >= targetCount) break;
      }
      unchangedRounds = newAds.length ? 0 : unchangedRounds + 1;
      await options.onProgress?.({ discoveredCount: collected.size, scrollCount, newAds });

      if (collected.size >= targetCount) { stopReason = "target_reached"; break; }
      if (await options.shouldStop?.()) { stopReason = "user_requested"; break; }
      if (unchangedRounds >= stableLimit) { stopReason = "no_new_results"; break; }
      if (scrollCount >= maxScrolls) { stopReason = "max_scrolls"; break; }

      const knownDomIds = await readMetaAdLibraryIds(page);
      await page.evaluate(() => window.scrollTo(0, document.scrollingElement?.scrollHeight || document.body.scrollHeight));
      await page.mouse.wheel(0, 1600);
      scrollCount += 1;
      const loadResult = await loadMoreMetaAds(page, knownDomIds, resultWaitMs);
      if (loadResult === "rate_limited") { stopReason = "rate_limited"; break; }
    }
    return { ads: [...collected.values()], scrollCount, stopReason };
  } finally {
    await browser.close();
  }
}
