"use client";

import { useEffect, useMemo, useState } from "react";

type Observation = { id?: string; observedAt: string; isActive: boolean | null; platforms: string[]; duplicateCount: number | null };
type Ad = { id: string; canonicalKey: string; sourceAdId: string | null; body: string; headline: string | null; cta: string | null; landingPageUrl: string | null; isWatched: boolean; tags: string[]; notes: string | null; advertiser?: { id: string; name: string; isWatched: boolean }; advertiserName?: string; observations: Observation[] };
type Scan = { id: string; keyword: string; country?: string; method?: string; status: string; resultCount: number; targetCount?: number; discoveredCount?: number; scrollCount?: number; duplicateAdsCount?: number; duplicateGroupCount?: number; totalInstances?: number; highDuplicateCount?: number; advertiserCount?: number; progressMessage?: string | null; stopRequestedAt?: string | null; errorCode?: string | null; errorMessage?: string | null; createdAt?: string; startedAt?: string | null; finishedAt?: string | null; job?: { status: string; attempts: number } | null };
type Opportunity = { id: string; name: string; status: string; score: number; confidence: number; nextAction: string };
type DuplicateGroup = { fingerprint: string; advertiserName: string; instanceCount: number; headline: string | null; body: string; ads: { id: string; sourceAdId: string | null }[] };
type ScanSummary = { scanId: string; keyword: string; country: string; resultCount: number; duplicateAdsCount: number; duplicateGroupCount: number; totalInstances: number; highDuplicateCount: number; advertiserCount: number; groups: DuplicateGroup[] };
type Inbox = { ads: Ad[]; scans: Scan[]; opportunities: Opportunity[]; scanSummary?: ScanSummary | null };
type ModalState = { open: boolean; scan: Scan | null; keyword: string; country: string; targetCount: number; timedOut: boolean };

const demoImport = JSON.stringify({ ads: [{ libraryId: "DEMO-MANUAL-01", pageName: "Manual Demo Store", body: "Sneakers ringan untuk aktivitas harian", headline: "Nyaman setiap langkah", cta: "SHOP_NOW", destinationUrl: "https://example.invalid/manual", isActive: true, platforms: ["facebook", "instagram"], duplicateCount: 3 }] }, null, 2);
const regions: Record<string,string> = { ID: "Indonesia", MY: "Malaysia", SG: "Singapura", PH: "Filipina", TH: "Thailand", VN: "Vietnam", US: "Amerika Serikat" };
const terminal = new Set(["succeeded", "partial", "failed", "cancelled"]);
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

export default function MetaAdsInbox({ initial }: { initial: Inbox }) {
  const [data, setData] = useState(initial);
  const [keyword, setKeyword] = useState("sepatu sneakers pria");
  const [country, setCountry] = useState("ID");
  const [method, setMethod] = useState("playwright");
  const [targetCount, setTargetCount] = useState(100);
  const [json, setJson] = useState(demoImport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<Ad | null>(data.ads[0] || null);
  const [oppName, setOppName] = useState("Peluang sneakers harian");
  const [modal, setModal] = useState<ModalState>({ open: false, scan: null, keyword: "", country: "ID", targetCount: 100, timedOut: false });

  const filtered = useMemo(() => data.ads.filter(ad => (!watchedOnly || ad.isWatched) && `${ad.advertiser?.name || ad.advertiserName} ${ad.headline} ${ad.body}`.toLowerCase().includes(query.toLowerCase())), [data.ads, query, watchedOnly]);

  async function refresh() {
    const response = await fetch("/api/meta-ads/scans", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }

  async function pollScan(scanId: string) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const response = await fetch(`/api/meta-ads/scans/${scanId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("SCAN_STATUS_UNAVAILABLE");
      const current: Scan = await response.json();
      setModal(value => ({ ...value, scan: current }));
      if (terminal.has(current.status)) {
        await refresh();
        return current;
      }
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
      const response = await fetch("/api/meta-ads/scans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ keyword, country, targetCount, method, payload }) });
      const created: Scan & { code?: string } = await response.json();
      if (!response.ok) throw new Error(created.code || "SCAN_FAILED");
      setModal(value => ({ ...value, scan: created }));
      const finished = method === "playwright" && !terminal.has(created.status) ? await pollScan(created.id) : created;
      if (finished.status === "failed" || finished.status === "partial") setError(`Scan ${finished.status}: ${finished.errorCode || "UNKNOWN_ERROR"}. Existing data tetap tersedia.`);
      await refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "SCAN_FAILED";
      setError(message);
      setModal(value => ({ ...value, scan: value.scan ? { ...value.scan, status: "failed", errorCode: message } : { id: "local-error", keyword: value.keyword, status: "failed", resultCount: 0, errorCode: message } }));
    } finally {
      setBusy(false);
    }
  }

  async function stopScan(scanId: string) {
    const response = await fetch(`/api/meta-ads/scans/${scanId}/stop`, { method: "POST" });
    if (!response.ok) { setError("Permintaan stop gagal dikirim."); return; }
    const stopped: Scan = await response.json();
    setModal(value => ({ ...value, scan: { ...(value.scan || stopped), ...stopped } }));
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

  async function createOpportunity() {
    if (!selected.length) return setError("Pilih minimal satu ad evidence.");
    setBusy(true);
    const response = await fetch("/api/opportunities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: oppName, adIds: selected, reason: "Evidence dari hasil Meta Ads scan", nextAction: "Validasi unit economics dan minta supplier quote" }) });
    if (response.ok) { setSelected([]); await refresh(); } else setError("Opportunity gagal dibuat.");
    setBusy(false);
  }

  return <div className="spy-page">
    <div className="spy-top"><div><a href="/dashboard" className="back">← Command Center</a><p className="eyebrow">INTELLIGENCE / META ADS SPY</p><h1>Evidence inbox</h1><p className="muted">Scan, simpan evidence, lalu ubah sinyal menjadi keputusan.</p></div><div className="scan-status"><b>{data.ads.length}</b><span>canonical ads</span><b>{data.scans.length}</b><span>scans</span></div></div>
    <section className="scan-card"><label>Keyword<input value={keyword} onChange={event => setKeyword(event.target.value)} /></label><label>Region<select value={country} onChange={event => setCountry(event.target.value)}>{Object.entries(regions).map(([code,name]) => <option value={code} key={code}>{name}</option>)}</select></label><label>Kategori<select value="all" disabled aria-label="Kategori iklan"><option value="all">All ads</option></select></label><label>Target iklan<input type="number" min="10" max="500" value={targetCount} onChange={event => setTargetCount(Math.min(500, Math.max(10, Number(event.target.value) || 10)))} /></label><label>Metode<select value={method} onChange={event => setMethod(event.target.value)}><option value="fixture">Fixture regression</option><option value="manual">JSON import</option><option value="playwright">Playwright live</option></select></label><button className="primary" onClick={scan} disabled={busy || keyword.length < 2}>{busy ? "Memproses…" : "Jalankan scan"}</button>{method === "manual" && <textarea value={json} onChange={event => setJson(event.target.value)} aria-label="JSON import" />}</section>
    {error && <div className="scan-error">{error}</div>}    {data.scanSummary && <section className="scan-summary"><div className="scan-summary-head"><div><p className="eyebrow">HASIL SCAN TERAKHIR</p><h2>{data.scanSummary.keyword}</h2><small>{regions[data.scanSummary.country] || data.scanSummary.country} · All ads</small></div></div><div className="scan-summary-metrics"><article><span>Iklan terkumpul</span><b>{data.scanSummary.resultCount}</b></article><article><span>Iklan duplikat</span><b>{data.scanSummary.duplicateAdsCount}</b></article><article><span>Grup duplikat</span><b>{data.scanSummary.duplicateGroupCount}</b></article><article><span>High duplicate</span><b>{data.scanSummary.highDuplicateCount}</b></article><article><span>Advertiser</span><b>{data.scanSummary.advertiserCount}</b></article></div>{data.scanSummary.groups.length > 0 && <div className="duplicate-groups"><h3>Konten dengan Library ID berbeda</h3>{data.scanSummary.groups.map((group,index) => <article key={group.fingerprint}><span>{index + 1}</span><div><strong>{group.advertiserName}</strong><p>{group.headline || group.body || "Konten tanpa headline"}</p><small>{group.ads.map(ad => ad.sourceAdId).filter(Boolean).join(" · ")}</small></div><b>{group.instanceCount}× duplikat</b></article>)}</div>}</section>}
    <div className="spy-grid"><section className="inbox"><div className="inbox-tools"><input placeholder="Cari advertiser, headline, atau teks…" value={query} onChange={event => setQuery(event.target.value)} /><label><input type="checkbox" checked={watchedOnly} onChange={event => setWatchedOnly(event.target.checked)} /> Watchlist saja</label></div>{filtered.length === 0 ? <div className="empty"><h2>Belum ada evidence</h2><p>Jalankan fixture scan atau import JSON extension.</p></div> : filtered.map(ad => <article className={`ad-row ${active?.id === ad.id ? "selected" : ""}`} key={ad.id} onClick={() => setActive(ad)}><input type="checkbox" checked={selected.includes(ad.id)} onClick={event => event.stopPropagation()} onChange={event => setSelected(value => event.target.checked ? [...value, ad.id] : value.filter(id => id !== ad.id))} /><div className="ad-copy"><div><strong>{ad.advertiser?.name || ad.advertiserName}</strong><span>{ad.sourceAdId || "fingerprint identity"}</span></div><h3>{ad.headline || "Tanpa headline"}</h3><p>{ad.body}</p><small>{ad.observations.length} observation · {ad.observations[0]?.platforms.join(", ") || "platform tidak tersedia"}</small></div><button className={ad.isWatched ? "watching" : ""} onClick={event => { event.stopPropagation(); void patchAd(ad, { isWatched: !ad.isWatched }); }}>{ad.isWatched ? "★" : "☆"}</button></article>)}</section>
      <aside className="detail">{active ? <><p className="eyebrow">AD DETAIL</p>{active.advertiser && <button className="advertiser-watch" onClick={() => void watchAdvertiser(active)}>{active.advertiser.isWatched ? "★ Advertiser watched" : "☆ Watch advertiser"}</button>}<h2>{active.headline || "Tanpa headline"}</h2><p>{active.body || "Primary text tidak tersedia."}</p>{active.landingPageUrl && <a href={active.landingPageUrl} target="_blank" rel="noreferrer">Landing page ↗</a>}<dl><dt>Stable identity</dt><dd>{active.canonicalKey}</dd><dt>Observations</dt><dd>{active.observations.length}</dd></dl><label>Tags<input defaultValue={active.tags.join(", ")} onBlur={event => void patchAd(active, { tags: event.target.value.split(",").map(value => value.trim()).filter(Boolean) })} /></label><label>Notes<textarea defaultValue={active.notes || ""} onBlur={event => void patchAd(active, { notes: event.target.value })} /></label><h3>Observation history</h3>{active.observations.map((observation, index) => <div className="observation" key={observation.id || `${observation.observedAt}-${index}`}><span className={observation.isActive ? "live" : ""} /><div><strong>{new Date(observation.observedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</strong><small>{observation.platforms.join(", ") || "Platform tidak tersedia"} · reuse signal {observation.duplicateCount ?? "—"}</small></div></div>)}</> : <p>Pilih ad untuk melihat detail.</p>}</aside></div>
    <section className="opportunity-bar"><div><p className="eyebrow">DECISION WORKFLOW</p><h2>Buat opportunity dari evidence</h2><p>{selected.length} ad dipilih</p></div><input value={oppName} onChange={event => setOppName(event.target.value)} aria-label="Opportunity name" /><button className="primary" onClick={createOpportunity} disabled={busy || !selected.length}>Simpan opportunity</button></section>
    <section className="opportunity-list"><h2>Opportunity inbox</h2>{data.opportunities.length ? data.opportunities.map(opportunity => <article key={opportunity.id}><div><strong>{opportunity.name}</strong><p>{opportunity.nextAction}</p></div><span>{opportunity.status}</span><b>{opportunity.score}<small>/100 score</small></b><b>{opportunity.confidence}<small>/100 confidence</small></b></article>) : <p className="muted">Belum ada opportunity tersimpan.</p>}</section>
    <section className="scan-history"><h2>Scan history</h2>{data.scans.map(item => <div key={item.id}><strong>{item.keyword}</strong><span className={item.status}>{item.status}</span><small>{item.resultCount} results · {regions[item.country || "ID"] || item.country} · All ads {item.errorCode && `· ${item.errorCode}`}</small></div>)}</section>
    {modal.open && <ScanProgressModal state={modal} onStop={stopScan} onClose={() => setModal(value => ({ ...value, open: false }))} />}
  </div>;
}

function ScanProgressModal({ state, onClose, onStop }: { state: ModalState; onClose: () => void; onStop: (scanId: string) => Promise<void> }) {
  const status = state.scan?.status || "submitting";
  const isTerminal = terminal.has(status);
  const discovered = state.scan?.discoveredCount || state.scan?.resultCount || 0;
  const target = state.scan?.targetCount || state.targetCount;
  const progress = status === "submitting" ? 4 : status === "queued" ? 8 : status === "summarizing" ? 94 : isTerminal ? 100 : Math.min(90, Math.max(12, (discovered / target) * 90));
  const stages = [
    { key: "queued", label: "Job masuk antrean", detail: "Permintaan dan target disimpan secara durable di PostgreSQL." },
    { key: "collecting", label: "Playwright mengumpulkan iklan", detail: "Auto-scroll memuat kartu baru dan menyimpan setiap batch." },
    { key: "summarizing", label: "Merangkum duplikasi", detail: "Konten dikelompokkan berdasarkan advertiser, primary text, headline, dan CTA." },
    { key: "succeeded", label: "Evidence tersimpan", detail: `${state.scan?.resultCount || 0} iklan selesai diproses.` }
  ];
  const reached = (key: string) => key === "queued" ? status !== "submitting" : key === "collecting" ? ["collecting", "running", "stop_requested", "summarizing", "succeeded", "partial", "failed"].includes(status) : key === "summarizing" ? ["summarizing", "succeeded", "partial"].includes(status) : ["succeeded", "partial"].includes(status);
  const canStop = Boolean(state.scan?.id && !isTerminal && !["summarizing", "stop_requested"].includes(status));
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === "Escape" && isTerminal) onClose(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [isTerminal, onClose]);
  return <div className="scan-modal-backdrop" role="presentation"><section className="scan-modal" role="dialog" aria-modal="true" aria-labelledby="scan-modal-title" aria-live="polite"><div className="scan-modal-head"><div><p className="eyebrow">PLAYWRIGHT LIVE SCAN</p><h2 id="scan-modal-title">Mengambil evidence untuk “{state.keyword}”</h2></div><span className={`scan-modal-status ${status}`}>{status.replace("_", " ")}</span></div><p className="scan-filter-summary">{regions[state.country] || state.country} · All ads · Active ads</p><div className="live-scan-counter"><div><b>{discovered}</b><span>dari target {target} iklan</span></div><small>Auto-scroll {state.scan?.scrollCount || 0} · {state.scan?.progressMessage || "Menyiapkan browser"}</small></div><div className="scan-progress-track"><span style={{ width: `${progress}%` }} /></div><p className="scan-progress-caption">{status === "queued" ? "Menunggu worker tersedia…" : ["collecting", "running"].includes(status) ? "Jumlah akan terus bertambah saat halaman di-scroll otomatis." : status === "stop_requested" ? "Stop diterima. Menyelesaikan batch aktif sebelum merangkum…" : status === "summarizing" ? "Browser ditutup; data yang terkumpul sedang dirangkum…" : status === "succeeded" ? `Selesai — ${state.scan?.resultCount || 0} iklan tersimpan.` : status === "partial" ? "Selesai sebagian; evidence yang valid tetap disimpan." : status === "failed" ? "Scan gagal; data lama tetap aman." : "Mengirim permintaan scan…"}</p><div className="scan-stage-list">{stages.map((stage,index) => <div className={`scan-stage ${reached(stage.key) ? "done" : ""} ${stage.key === status ? "current" : ""}`} key={stage.key}><span>{reached(stage.key) ? "✓" : index + 1}</span><div><strong>{stage.label}</strong><p>{stage.detail}</p></div></div>)}</div>{(status === "failed" || status === "partial" || state.timedOut) && <div className="scan-modal-error"><strong>{state.timedOut ? "Pemantauan melewati batas waktu" : state.scan?.errorCode || "PARTIAL_SCAN"}</strong><p>{state.scan?.errorMessage || "Last-known-good evidence tidak dihapus."}</p></div>}<footer><small>Scan ID: {state.scan?.id || "menunggu…"}</small><div className="scan-modal-actions">{canStop && <button className="stop-scan" onClick={() => void onStop(state.scan!.id)}>Stop & rangkum</button>}{isTerminal ? <button className="primary" onClick={onClose}>Lihat hasil</button> : <button className="secondary" onClick={onClose}>Jalankan di background</button>}</div></footer></section></div>;
}