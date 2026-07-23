"use client";

import { useEffect, useMemo, useState } from "react";
import AnimatedContent from "./AnimatedContent";
import CountUp from "./CountUp";
import SpotlightCard from "./SpotlightCard";

type Observation = { id?: string; observedAt: string; isActive: boolean | null; platforms: string[]; duplicateCount: number | null };
type Ad = { id: string; canonicalKey: string; sourceAdId: string | null; body: string; headline: string | null; cta: string | null; landingPageUrl: string | null; isWatched: boolean; tags: string[]; notes: string | null; advertiser?: { id: string; name: string; isWatched: boolean }; advertiserName?: string; observations: Observation[] };
type InsightState = { status: string; model?: string; errorCode?: string | null; errorMessage?: string | null };
type ScanStopReason = "target_reached" | "user_requested" | "no_new_results" | "max_scrolls" | "rate_limited";
type Scan = { id: string; keyword: string; country?: string; method?: string; status: string; resultCount: number; targetCount?: number; discoveredCount?: number; scrollCount?: number; stopReason?: ScanStopReason | null; progressMessage?: string | null; errorCode?: string | null; errorMessage?: string | null; insight?: InsightState | null; analysisJob?: { status: string; attempts: number } | null };
type Opportunity = { id: string; name: string; status: string; score: number; confidence: number; nextAction: string };
type DuplicateGroup = { fingerprint: string; advertiserName: string; instanceCount: number; headline: string | null; body: string; ads: { id: string; sourceAdId: string | null }[] };
type ScanSummary = { scanId: string; keyword: string; country: string; resultCount: number; duplicateAdsCount: number; duplicateGroupCount: number; totalInstances: number; highDuplicateCount: number; advertiserCount: number; groups: DuplicateGroup[] };
type Inbox = { ads: Ad[]; scans: Scan[]; opportunities: Opportunity[]; scanSummary?: ScanSummary | null; latestInsight?: unknown };
type ModalState = { open: boolean; scan: Scan | null; keyword: string; country: string; targetCount: number; timedOut: boolean };
type ProductTrend = { product: string; category: string; signal: "dominant_current_scan" | "emerging" | "rising" | "stable" | "declining"; score: number; confidence: number; adCount: number; advertiserCount: number; why: string; evidenceLibraryIds: string[] };
type DuplicateInsight = { clusterName: string; instanceCount: number; advertiserNames: string[]; interpretation: string; evidenceLibraryIds: string[] };
type WinningAngle = { angle: string; frequency: number; explanation: string; exampleLibraryIds: string[] };
type Recommendation = { priority: "high" | "medium" | "low"; action: string; rationale: string; evidence: string[] };
type Risk = { risk: string; explanation: string };
type InsightRecord = { scanId: string; status: string; model: string; executiveSummary?: string | null; marketVerdict?: string | null; confidence: number; productTrends?: ProductTrend[] | null; duplicateInsights?: DuplicateInsight[] | null; winningAngles?: WinningAngle[] | null; recommendations?: Recommendation[] | null; risks?: Risk[] | null; errorCode?: string | null; errorMessage?: string | null };
type BrowserScanMessage = { source?: string; type?: string; requestId?: string; count?: number; scrollCount?: number; ads?: unknown[]; error?: string; stopReason?: string };
type BrowserScanResult = { ads: unknown[]; scrollCount: number; stopReason: ScanStopReason };

const regions: Record<string, string> = { ID: "Indonesia", MY: "Malaysia", SG: "Singapura", PH: "Filipina", TH: "Thailand", VN: "Vietnam", US: "Amerika Serikat" };
const terminal = new Set(["succeeded", "partial", "failed", "cancelled"]);
const insightTerminal = new Set(["succeeded", "failed"]);
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const demoImport = JSON.stringify({ ads: [{ libraryId: "DEMO-MANUAL-01", pageName: "Manual Demo Store", body: "Sneakers ringan untuk aktivitas harian", headline: "Nyaman setiap langkah", cta: "SHOP_NOW", destinationUrl: "https://example.invalid/manual", isActive: true, platforms: ["facebook", "instagram"], duplicateCount: 3 }] }, null, 2);
const verdictLabel: Record<string, string> = { strong_opportunity: "Peluang kuat", watch: "Pantau", insufficient_evidence: "Evidence terbatas", avoid: "Hindari sementara" };
const signalLabel: Record<ProductTrend["signal"], string> = { dominant_current_scan: "Dominan di scan ini", emerging: "Mulai muncul", rising: "Sedang naik", stable: "Stabil", declining: "Menurun" };
const scanStopReasonLabel: Record<ScanStopReason, string> = { target_reached: "Target tercapai", user_requested: "Dihentikan pengguna", no_new_results: "Meta tidak memuat hasil baru", max_scrolls: "Batas keamanan scroll tercapai", rate_limited: "Meta membatasi pagination sementara" };
const browserErrorLabel: Record<string, string> = {
  EXTENSION_NOT_CONNECTED: "Extension WarSneaks v3 belum terhubung. Unduh ZIP, ekstrak, pilih Load unpacked di chrome://extensions, lalu muat ulang dashboard.",
  BROWSER_SCAN_TIMEOUT: "Scan tab browser melewati 15 menit. Pastikan tab Meta tetap terbuka lalu coba lagi.",
  BROWSER_SCAN_EMPTY: "Meta tidak menampilkan iklan yang dapat dibaca untuk pencarian ini.",
  META_TAB_CREATE_FAILED: "Extension tidak dapat membuka tab Meta Ads Library.",
  META_TAB_CLOSED: "Tab Meta ditutup sebelum scan selesai. Jalankan ulang dan pertahankan tab tersebut tetap terbuka.",
  META_TAB_NAVIGATED: "Tab Meta berpindah halaman sebelum scan selesai. Jalankan ulang tanpa menggunakan tab tersebut sampai evidence tersimpan.",
};
const isScanStopReason = (value: unknown): value is ScanStopReason => typeof value === "string" && Object.hasOwn(scanStopReasonLabel, value);
const buildBrowserScanUrl = (keyword: string, country: string) => { const params = new URLSearchParams({ active_status: "active", ad_type: "all", country, is_targeted_country: "false", media_type: "all", q: keyword, search_type: "keyword_unordered", "sort_data[mode]": "total_impressions", "sort_data[direction]": "desc" }); return `https://www.facebook.com/ads/library/?${params.toString()}`; };

export default function MetaAdsInbox({ initial }: { initial: Inbox }) {
  const [data, setData] = useState(initial);
  const [keyword, setKeyword] = useState("sepatu sneakers pria");
  const [country, setCountry] = useState("ID");
  const [targetCount, setTargetCount] = useState(100);
  const [method, setMethod] = useState("browser");
  const [json, setJson] = useState(demoImport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [extensionReady, setExtensionReady] = useState<boolean | null>(null);
  const [showAds, setShowAds] = useState(false);
  const [query, setQuery] = useState("");
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [active, setActive] = useState<Ad | null>(data.ads[0] || null);
  const [modal, setModal] = useState<ModalState>({ open: false, scan: null, keyword: "", country: "ID", targetCount: 100, timedOut: false });
  const insight = (data.latestInsight || null) as InsightRecord | null;
  const summary = data.scanSummary || null;

  const filtered = useMemo(() => data.ads.filter(ad => (!watchedOnly || ad.isWatched) && `${ad.advertiser?.name || ad.advertiserName} ${ad.headline} ${ad.body}`.toLowerCase().includes(query.toLowerCase())), [data.ads, query, watchedOnly]);
  const trends = useMemo(() => [...(insight?.productTrends || [])].sort((a, b) => b.score - a.score), [insight]);

  async function refresh() {
    const response = await fetch("/api/meta-ads/scans", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }

  useEffect(() => {
    if (!insight || !["queued", "running"].includes(insight.status)) return;
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [insight?.status]);

  useEffect(() => {
    const handler = (event: MessageEvent<BrowserScanMessage>) => {
      if (event.source === window && event.data?.source === "warsneaks-extension" && event.data.type === "WARSNEAKS_EXTENSION_READY") setExtensionReady(true);
    };
    const timer = window.setTimeout(() => setExtensionReady(value => value ?? false), 1500);
    window.addEventListener("message", handler);
    window.postMessage({ source: "warsneaks-dashboard", type: "WARSNEAKS_EXTENSION_PING" }, window.location.origin);
    return () => { window.clearTimeout(timer); window.removeEventListener("message", handler); };
  }, []);

  function collectInBrowser() {
    const requestId = `browser-${crypto.randomUUID()}`;
    return new Promise<BrowserScanResult>((resolve, reject) => {
      let started = false;
      const cleanup = () => { window.removeEventListener("message", handler); window.clearTimeout(startTimer); window.clearTimeout(overallTimer); };
      const fail = (code: string) => { cleanup(); reject(new Error(code)); };
      const handler = (event: MessageEvent<BrowserScanMessage>) => {
        if (event.source !== window || event.data?.source !== "warsneaks-extension" || event.data.requestId !== requestId) return;
        if (event.data.type === "WARSNEAKS_META_SCAN_STARTED") {
          started = true;
          setModal(value => ({ ...value, scan: { id: requestId, keyword: value.keyword, country: value.country, method: "browser", status: "collecting", resultCount: 0, discoveredCount: 0, scrollCount: 0, progressMessage: "Tab Meta Ads Library dibuka di browser" } }));
        }
        if (event.data.type === "WARSNEAKS_META_SCAN_PROGRESS") {
          const count = event.data.count || 0;
          setModal(value => ({ ...value, scan: { ...(value.scan || { id: requestId, keyword: value.keyword, country: value.country, method: "browser", status: "collecting", resultCount: 0 }), status: "collecting", discoveredCount: count, resultCount: count, scrollCount: event.data.scrollCount || 0, progressMessage: `${count} iklan terkumpul dari tab browser` } }));
        }
        if (event.data.type === "WARSNEAKS_META_SCAN_COMPLETED") {
          const ads = Array.isArray(event.data.ads) ? event.data.ads : [];
          const stopReason = isScanStopReason(event.data.stopReason) ? event.data.stopReason : "no_new_results";
          setModal(value => ({ ...value, scan: { ...(value.scan || { id: requestId, keyword: value.keyword, country: value.country, method: "browser", status: "summarizing", resultCount: ads.length }), status: "summarizing", resultCount: ads.length, discoveredCount: ads.length, scrollCount: event.data.scrollCount || 0, stopReason, progressMessage: `Mengirim ${ads.length} iklan ke WarSneaks` } }));
          cleanup();
          resolve({ ads, scrollCount: event.data.scrollCount || 0, stopReason });
        }
        if (event.data.type === "WARSNEAKS_META_SCAN_ERROR") fail(event.data.error || "BROWSER_SCAN_FAILED");
      };
      const startTimer = window.setTimeout(() => { if (!started) fail("EXTENSION_NOT_CONNECTED"); }, 8000);
      const overallTimer = window.setTimeout(() => fail("BROWSER_SCAN_TIMEOUT"), 15 * 60_000);
      window.addEventListener("message", handler);
      window.postMessage({ source: "warsneaks-dashboard", type: "WARSNEAKS_START_META_SCAN", requestId, url: buildBrowserScanUrl(keyword, country), targetCount }, window.location.origin);
    });
  }

  async function pollScan(scanId: string) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const response = await fetch(`/api/meta-ads/scans/${scanId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("SCAN_STATUS_UNAVAILABLE");
      const current: Scan = await response.json();
      setModal(value => ({ ...value, scan: current }));
      const scanFinished = terminal.has(current.status);
      const analysisPending = scanFinished && current.resultCount > 0 && (!current.insight || ["queued", "running"].includes(current.insight.status));
      if (scanFinished && !analysisPending) { await refresh(); return current; }
      await wait(1500);
    }
    setModal(value => ({ ...value, timedOut: true }));
    throw new Error("SCAN_POLL_TIMEOUT");
  }

  async function scan() {
    setBusy(true);
    setError("");
    setModal({ open: true, scan: null, keyword, country, targetCount, timedOut: false });
    try {
      let payload: unknown;
      if (method === "manual") payload = JSON.parse(json);
      if (method === "browser") {
        const browserResult = await collectInBrowser();
        if (!browserResult.ads.length) throw new Error("BROWSER_SCAN_EMPTY");
        payload = browserResult;
      }
      const response = await fetch("/api/meta-ads/scans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ keyword, country, targetCount, method, payload }) });
      const created: Scan & { code?: string } = await response.json();
      if (!response.ok) throw new Error(created.code || "SCAN_FAILED");
      setModal(value => ({ ...value, scan: created }));
      let finished = method === "playwright" && !terminal.has(created.status) ? await pollScan(created.id) : created;
      if (method === "browser" && created.resultCount > 0) {
        const analysis = await fetch(`/api/meta-ads/scans/${created.id}/analyze`, { method: "POST" });
        if (!analysis.ok) throw new Error("INSIGHT_QUEUE_FAILED");
        finished = await pollScan(created.id);
      }
      if (["failed", "partial"].includes(finished.status)) setError(`Scan ${finished.status}: ${finished.errorCode || "UNKNOWN_ERROR"}. Evidence lama tetap aman.`);
      await refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "SCAN_FAILED";
      setError(browserErrorLabel[message] || message);
      setModal(value => ({ ...value, scan: value.scan ? { ...value.scan, status: "failed", errorCode: message } : { id: "local-error", keyword: value.keyword, country: value.country, status: "failed", resultCount: 0, errorCode: message } }));
    } finally { setBusy(false); }
  }

  async function stopScan(scanId: string) {
    if (scanId.startsWith("browser-")) {
      window.postMessage({ source: "warsneaks-dashboard", type: "WARSNEAKS_STOP_META_SCAN", requestId: scanId }, window.location.origin);
      setModal(value => ({ ...value, scan: value.scan ? { ...value.scan, status: "stop_requested", progressMessage: "Menghentikan scan pada tab browser" } : null }));
      return;
    }
    const response = await fetch(`/api/meta-ads/scans/${scanId}/stop`, { method: "POST" });
    if (!response.ok) return setError("Permintaan stop gagal dikirim.");
    const stopped: Scan = await response.json();
    setModal(value => ({ ...value, scan: { ...(value.scan || stopped), ...stopped } }));
  }

  async function retryInsight() {
    if (!summary) return;
    setError("");
    const response = await fetch(`/api/meta-ads/scans/${summary.scanId}/analyze`, { method: "POST" });
    if (!response.ok) return setError("Analisis DeepSeek gagal dijadwalkan ulang.");
    await refresh();
  }

  async function patchAd(ad: Ad, patch: Partial<Pick<Ad, "isWatched" | "tags" | "notes">>) {
    const response = await fetch(`/api/meta-ads/ads/${ad.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    if (response.ok) { await refresh(); setActive({ ...ad, ...patch }); }
  }

  async function watchAdvertiser(ad: Ad) {
    if (!ad.advertiser) return;
    const response = await fetch(`/api/meta-ads/advertisers/${ad.advertiser.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isWatched: !ad.advertiser.isWatched }) });
    if (response.ok) { await refresh(); setActive({ ...ad, advertiser: { ...ad.advertiser, isWatched: !ad.advertiser.isWatched } }); }
  }

  return <main className="mi-page">
    <header className="mi-header"><div><a href="/dashboard" className="mi-back">← Command Center</a><div className="mi-kicker"><span className="mi-live-dot" /> MARKET INTELLIGENCE · DEEPSEEK FLASH</div><h1>Keputusan pasar, <span>bukan tumpukan data.</span></h1><p>WarSneaks mengumpulkan evidence Meta Ads lalu DeepSeek merangkumnya menjadi produk, pola, dan tindakan.</p></div><button className="mi-outline-button" onClick={() => setShowAds(true)}>Lihat semua iklan <b>{data.ads.length}</b></button></header>

    <section className="mi-scan-bar">
      <label className="mi-keyword"><span>Keyword</span><input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="Contoh: gamis wanita" /></label>
      <label><span>Region</span><select value={country} onChange={event => setCountry(event.target.value)}>{Object.entries(regions).map(([code, name]) => <option value={code} key={code}>{name}</option>)}</select></label>
      <label><span>Kategori</span><select value="all" disabled><option value="all">All ads</option></select></label>
      <label><span>Target iklan</span><input type="number" min="10" max="500" value={targetCount} onChange={event => setTargetCount(Math.min(500, Math.max(10, Number(event.target.value) || 10)))} /></label>
      <label><span>Metode</span><select value={method} onChange={event => setMethod(event.target.value)}><option value="browser">Tab browser pengguna</option><option value="fixture">Fixture regression</option><option value="manual">JSON import</option></select></label>
      <button className="mi-primary-button" onClick={scan} disabled={busy || keyword.length < 2}>{busy ? "Berjalan…" : "Mulai analisis"}</button>
      {method === "browser" && <div className="mi-browser-note">
        <span className={`mi-extension-status ${extensionReady ? "ready" : extensionReady === false ? "missing" : "checking"}`}>{extensionReady ? "Extension terhubung" : extensionReady === false ? "Extension belum terhubung" : "Memeriksa extension"}</span>
        <span>Tab Meta akan terlihat dan berjalan di laptop ini. Pertahankan tab Meta serta dashboard tetap terbuka sampai evidence tersimpan.</span>
        <span><a href="/warsneaks-meta-extension.zip" download>Unduh extension v3</a> · ekstrak ZIP · buka chrome://extensions · aktifkan Developer mode · Load unpacked · muat ulang dashboard.</span>
      </div>}
      {method === "manual" && <textarea value={json} onChange={event => setJson(event.target.value)} aria-label="JSON import" />}
    </section>
    {error && <div className="mi-error">{error}</div>}

    {!summary ? <EmptyInsight onScan={scan} /> : <>
      <AnimatedContent distance={28} duration={0.55}><SpotlightCard className="mi-ai-hero" spotlightColor="rgba(97, 94, 252, 0.16)"><div className="mi-ai-badge"><span>✦</span> DEEPSEEK MARKET BRIEF</div>{insight?.status === "succeeded" ? <><div className="mi-verdict-row"><span className={`mi-verdict ${insight.marketVerdict}`}>{verdictLabel[insight.marketVerdict || ""] || insight.marketVerdict}</span><span>{insight.confidence}% confidence</span><span>{summary.resultCount} ads · {summary.advertiserCount} advertiser</span></div><h2>{insight.executiveSummary}</h2><div className="mi-hero-meta"><span>Keyword <b>{summary.keyword}</b></span><span>Region <b>{regions[summary.country] || summary.country}</b></span><span>Model <b>{insight.model}</b></span></div></> : <InsightPending insight={insight} onRetry={retryInsight} />}</SpotlightCard></AnimatedContent>

      <section className="mi-metrics"><Metric label="Iklan dianalisis" value={summary.resultCount} note="Library ID unik" /><Metric label="Konten duplikat" value={summary.duplicateAdsCount} note={`${summary.duplicateGroupCount} kelompok creative`} /><Metric label="High duplicate" value={summary.highDuplicateCount} note="Minimal 5 instance" /><Metric label="Advertiser" value={summary.advertiserCount} note="Sumber evidence unik" /></section>

      <section className="mi-section"><div className="mi-section-head"><div><p className="mi-eyebrow">PRODUCT SIGNALS</p><h2>Produk yang patut diperhatikan</h2><p>DeepSeek menggabungkan variasi nama produk dan menilai kekuatan signal dari seluruh evidence.</p></div><span className="mi-section-count">{trends.length} signal</span></div>{trends.length ? <div className="mi-trend-grid">{trends.map((trend, index) => <AnimatedContent key={`${trend.product}-${index}`} delay={Math.min(index * .05, .3)} distance={20}><article className="mi-trend-card"><div className="mi-trend-top"><span className={`mi-signal ${trend.signal}`}>{signalLabel[trend.signal]}</span><b>{trend.score}</b></div><p className="mi-category">{trend.category}</p><h3>{trend.product}</h3><p>{trend.why}</p><div className="mi-card-stats"><span><b>{trend.adCount}</b> ads</span><span><b>{trend.advertiserCount}</b> advertiser</span><span><b>{trend.confidence}%</b> confidence</span></div><small>Evidence: {trend.evidenceLibraryIds.slice(0, 4).join(" · ") || "tersimpan pada scan"}</small></article></AnimatedContent>)}</div> : <InsightSkeleton label="Signal produk akan tampil setelah analisis DeepSeek selesai." />}</section>

      <div className="mi-insight-grid"><section className="mi-section mi-duplicates"><div className="mi-section-head"><div><p className="mi-eyebrow">CREATIVE REUSE</p><h2>Iklan yang terdeteksi duplikat</h2></div></div>{(insight?.duplicateInsights || []).length ? <div className="mi-duplicate-list">{insight!.duplicateInsights!.map((item, index) => <article key={`${item.clusterName}-${index}`}><span className="mi-rank">{String(index + 1).padStart(2, "0")}</span><div><h3>{item.clusterName}</h3><p>{item.interpretation}</p><small>{item.advertiserNames.join(" · ")} · {item.evidenceLibraryIds.slice(0, 4).join(" · ")}</small></div><b>{item.instanceCount}×</b></article>)}</div> : summary.groups.length ? <div className="mi-duplicate-list">{summary.groups.slice(0, 6).map((group, index) => <article key={group.fingerprint}><span className="mi-rank">{String(index + 1).padStart(2, "0")}</span><div><h3>{group.headline || group.advertiserName}</h3><p>{group.body}</p><small>{group.advertiserName} · {group.ads.map(ad => ad.sourceAdId).filter(Boolean).slice(0, 4).join(" · ")}</small></div><b>{group.instanceCount}×</b></article>)}</div> : <div className="mi-empty-inline">Tidak ada creative dengan fingerprint identik pada scan ini.</div>}</section>

        <section className="mi-section mi-actions"><div className="mi-section-head"><div><p className="mi-eyebrow">NEXT BEST ACTION</p><h2>Apa yang sebaiknya dilakukan?</h2></div></div>{(insight?.recommendations || []).length ? <div className="mi-action-list">{insight!.recommendations!.map((item, index) => <article key={`${item.action}-${index}`}><span className={`mi-priority ${item.priority}`}>{item.priority}</span><div><h3>{item.action}</h3><p>{item.rationale}</p><small>{item.evidence.join(" · ")}</small></div></article>)}</div> : <InsightSkeleton label="Rekomendasi akan tampil setelah analisis selesai." />}</section></div>

      <div className="mi-insight-grid"><section className="mi-section"><div className="mi-section-head"><div><p className="mi-eyebrow">WINNING ANGLES</p><h2>Pola pesan yang berulang</h2></div></div><div className="mi-angle-list">{(insight?.winningAngles || []).map((item, index) => <article key={`${item.angle}-${index}`}><span>{item.frequency}×</span><div><h3>{item.angle}</h3><p>{item.explanation}</p></div></article>)}</div>{!(insight?.winningAngles || []).length && <InsightSkeleton label="Angle pemasaran sedang dirangkum." />}</section><section className="mi-section"><div className="mi-section-head"><div><p className="mi-eyebrow">RISKS & CAVEATS</p><h2>Yang perlu divalidasi</h2></div></div><div className="mi-risk-list">{(insight?.risks || []).map((item, index) => <article key={`${item.risk}-${index}`}><span>!</span><div><h3>{item.risk}</h3><p>{item.explanation}</p></div></article>)}</div>{!(insight?.risks || []).length && <InsightSkeleton label="Risk notes sedang disiapkan." />}</section></div>

      <section className="mi-evidence-cta"><div><p className="mi-eyebrow">AUDITABLE EVIDENCE</p><h2>Kesimpulan sudah siap. Data mentah tetap tersedia.</h2><p>Buka evidence hanya ketika Anda ingin memverifikasi Library ID, copy, CTA, atau landing page tertentu.</p></div><button className="mi-dark-button" onClick={() => setShowAds(true)}>Lihat semua iklan <span>→</span></button></section>
    </>}

    <section className="mi-history"><div className="mi-section-head"><div><p className="mi-eyebrow">SCAN HISTORY</p><h2>Analisis sebelumnya</h2></div></div>{data.scans.slice(0, 6).map(item => <article key={item.id}><div><strong>{item.keyword}</strong><small>{regions[item.country || "ID"] || item.country} · {item.resultCount} ads</small></div><span className={item.status}>{item.status.replace("_", " ")}</span></article>)}</section>

    {showAds && <AdsDrawer ads={filtered} allCount={data.ads.length} active={active} query={query} watchedOnly={watchedOnly} onQuery={setQuery} onWatchedOnly={setWatchedOnly} onSelect={setActive} onClose={() => setShowAds(false)} onPatch={patchAd} onWatchAdvertiser={watchAdvertiser} />}
    {modal.open && <ScanProgressModal state={modal} onStop={stopScan} onClose={() => setModal(value => ({ ...value, open: false }))} />}
  </main>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <SpotlightCard className="mi-metric" spotlightColor="rgba(97, 94, 252, 0.10)"><span>{label}</span><CountUp to={value} duration={1.2} separator="." /><small>{note}</small></SpotlightCard>;
}

function EmptyInsight({ onScan }: { onScan: () => Promise<void> }) {
  return <section className="mi-empty-insight"><span>✦</span><h2>Belum ada market brief</h2><p>Jalankan satu scan. DeepSeek akan membaca seluruh evidence dan mengubahnya menjadi kesimpulan.</p><button className="mi-primary-button" onClick={() => void onScan()}>Mulai scan pertama</button></section>;
}

function InsightPending({ insight, onRetry }: { insight: InsightRecord | null; onRetry: () => Promise<void> }) {
  if (insight?.status === "failed") return <div className="mi-insight-failed"><h2>Evidence tersimpan, tetapi analisis AI belum selesai.</h2><p>{insight.errorCode || "DEEPSEEK_ANALYSIS_FAILED"}. Anda dapat menjalankan analisis ulang tanpa scraping ulang.</p><button onClick={() => void onRetry()}>Analisis ulang</button></div>;
  return <div className="mi-thinking"><span className="mi-thinking-orb">✦</span><div><h2>DeepSeek sedang membaca seluruh evidence…</h2><p>Mengelompokkan produk, creative duplikat, angle, risiko, dan rekomendasi.</p></div><span className="mi-loading-dots"><i /><i /><i /></span></div>;
}

function InsightSkeleton({ label }: { label: string }) { return <div className="mi-skeleton"><span /><span /><p>{label}</p></div>; }

function AdsDrawer({ ads, allCount, active, query, watchedOnly, onQuery, onWatchedOnly, onSelect, onClose, onPatch, onWatchAdvertiser }: { ads: Ad[]; allCount: number; active: Ad | null; query: string; watchedOnly: boolean; onQuery: (value: string) => void; onWatchedOnly: (value: boolean) => void; onSelect: (ad: Ad) => void; onClose: () => void; onPatch: (ad: Ad, patch: Partial<Pick<Ad, "isWatched" | "tags" | "notes">>) => Promise<void>; onWatchAdvertiser: (ad: Ad) => Promise<void> }) {
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [onClose]);
  return <div className="mi-drawer-backdrop" role="presentation"><section className="mi-drawer" role="dialog" aria-modal="true" aria-label="Semua iklan"><header><div><p className="mi-eyebrow">RAW EVIDENCE</p><h2>Semua iklan <span>{allCount}</span></h2></div><button onClick={onClose} aria-label="Tutup">×</button></header><div className="mi-drawer-tools"><input placeholder="Cari advertiser, produk, atau copy…" value={query} onChange={event => onQuery(event.target.value)} /><label><input type="checkbox" checked={watchedOnly} onChange={event => onWatchedOnly(event.target.checked)} /> Watchlist</label></div><div className="mi-drawer-grid"><div className="mi-ad-list">{ads.map(ad => <article className={active?.id === ad.id ? "active" : ""} key={ad.id} onClick={() => onSelect(ad)}><div className="mi-ad-avatar">{(ad.advertiser?.name || ad.advertiserName || "?").charAt(0)}</div><div><div><strong>{ad.advertiser?.name || ad.advertiserName}</strong><small>{ad.sourceAdId || "fingerprint"}</small></div><h3>{ad.headline || "Tanpa headline"}</h3><p>{ad.body || "Primary text tidak tersedia."}</p><span>{ad.observations.length} observation · reuse {ad.observations[0]?.duplicateCount || 1}×</span></div></article>)}{!ads.length && <div className="mi-empty-inline">Tidak ada iklan yang sesuai filter.</div>}</div><aside className="mi-ad-detail">{active ? <><div className="mi-detail-brand"><div className="mi-detail-avatar">{(active.advertiser?.name || active.advertiserName || "?").charAt(0)}</div><div><span>Advertiser</span><h3>{active.advertiser?.name || active.advertiserName}</h3></div><button onClick={() => void onWatchAdvertiser(active)}>{active.advertiser?.isWatched ? "★" : "☆"}</button></div><div className="mi-detail-badges"><span className="active">Active</span><span>Library ID {active.sourceAdId || "—"}</span><span>{active.observations[0]?.duplicateCount || 1}× reuse</span></div><div className="mi-detail-copy"><span>Headline</span><h2>{active.headline || "Tanpa headline"}</h2><span>Primary text</span><p>{active.body || "Tidak tersedia."}</p>{active.cta && <div className="mi-detail-cta"><span>CTA</span><b>{active.cta}</b></div>}{active.landingPageUrl && <a href={active.landingPageUrl} target="_blank" rel="noreferrer">Buka landing page ↗</a>}</div><div className="mi-detail-fields"><label>Tags<input defaultValue={active.tags.join(", ")} onBlur={event => void onPatch(active, { tags: event.target.value.split(",").map(value => value.trim()).filter(Boolean) })} /></label><label>Catatan<textarea defaultValue={active.notes || ""} onBlur={event => void onPatch(active, { notes: event.target.value })} /></label></div><div className="mi-observation-history"><h3>Observation history</h3>{active.observations.map((observation, index) => <article key={observation.id || index}><span className={observation.isActive ? "live" : ""} /><div><strong>{new Date(observation.observedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</strong><small>{observation.platforms.join(", ") || "Platform tidak tersedia"}</small></div></article>)}</div></> : <div className="mi-empty-inline">Pilih iklan untuk melihat detail.</div>}</aside></div></section></div>;
}

function ScanProgressModal({ state, onClose, onStop }: { state: ModalState; onClose: () => void; onStop: (scanId: string) => Promise<void> }) {
  const scanStatus = state.scan?.status || "submitting";
  const browserScan = state.scan?.method === "browser" || state.scan?.id.startsWith("browser-") === true;
  const aiStatus = state.scan?.insight?.status;
  const displayStatus = terminal.has(scanStatus) && ["queued", "running"].includes(aiStatus || "") ? "analyzing" : scanStatus;
  const scanFinished = terminal.has(scanStatus);
  const isTerminal = scanFinished && (!aiStatus || insightTerminal.has(aiStatus));
  const discovered = state.scan?.discoveredCount || state.scan?.resultCount || 0;
  const target = state.scan?.targetCount || state.targetCount;
  const progress = displayStatus === "submitting" ? 4 : displayStatus === "queued" ? 8 : displayStatus === "summarizing" ? 82 : displayStatus === "analyzing" ? 94 : isTerminal ? 100 : Math.min(78, Math.max(12, (discovered / target) * 78));
  const canStop = Boolean(state.scan?.id && !scanFinished && !["summarizing", "stop_requested"].includes(scanStatus));
  const stopReasonLabel = state.scan?.stopReason ? scanStopReasonLabel[state.scan.stopReason] : null;
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === "Escape" && isTerminal) onClose(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [isTerminal, onClose]);
  return <div className="mi-modal-backdrop"><section className="mi-scan-modal" role="dialog" aria-modal="true" aria-live="polite"><header><div><p className="mi-eyebrow">LIVE MARKET ANALYSIS</p><h2>“{state.keyword}”</h2></div><span className={displayStatus}>{displayStatus.replace("_", " ")}</span></header><div className="mi-modal-filter">{regions[state.country] || state.country} · All ads · Active ads</div><div className="mi-live-count live-scan-counter"><CountUp to={discovered} duration={.5} /><div><b>dari target {target}</b><small>Auto-scroll {state.scan?.scrollCount || 0}</small></div></div><div className="mi-progress"><span style={{ width: `${progress}%` }} /></div><div className="mi-modal-stages"><article className={scanStatus !== "submitting" ? "done" : "active"}><span>1</span><div><b>{browserScan ? "Extension terhubung" : "Antrean tersimpan"}</b><small>{browserScan ? "Tab Meta dibuka di laptop ini" : "Job durable di PostgreSQL"}</small></div></article><article className={["collecting", "running", "stop_requested"].includes(scanStatus) ? "active" : scanFinished || ["summarizing"].includes(scanStatus) ? "done" : ""}><span>2</span><div><b>{browserScan ? "Tab browser mengumpulkan iklan" : "Playwright mengumpulkan iklan"}</b><small>{state.scan?.progressMessage || "Menyiapkan browser"}</small></div></article><article className={displayStatus === "summarizing" ? "active" : scanFinished ? "done" : ""}><span>3</span><div><b>Normalisasi evidence</b><small>Library ID dan duplicate fingerprint</small></div></article><article className={displayStatus === "analyzing" ? "active" : aiStatus === "succeeded" ? "done" : ""}><span>4</span><div><b>DeepSeek merangkum</b><small>Produk, angle, risiko, dan tindakan</small></div></article></div>{browserScan && !scanFinished && <div className="mi-modal-filter">Jaga tab Meta dan dashboard tetap terbuka sampai tahap normalisasi.</div>}{scanFinished && stopReasonLabel && <div className="mi-modal-filter">Alasan berhenti · <b>{stopReasonLabel}</b></div>}{state.scan?.insight?.status === "failed" && <div className="mi-error">Evidence tersimpan, tetapi DeepSeek gagal: {state.scan.insight.errorCode}</div>}<footer><small>Scan ID · {state.scan?.id || "menunggu"}</small><div>{canStop && <button className="mi-stop-button" onClick={() => void onStop(state.scan!.id)}>Stop & rangkum</button>}{isTerminal ? <button className="mi-primary-button" onClick={onClose}>Lihat insight</button> : <button className="mi-ghost-button" onClick={onClose}>{browserScan ? "Sembunyikan panel" : "Jalankan di background"}</button>}</div></footer></section></div>;
}
