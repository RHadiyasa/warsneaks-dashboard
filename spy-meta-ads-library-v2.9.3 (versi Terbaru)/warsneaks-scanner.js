(() => {
  if (window.__warsneaksBrowserScanner) return;

  const state = {
    ads: [],
    scanning: false,
    targetCount: 100,
    requestId: null,
    scrollCount: 0,
    lastCount: 0,
    lastProgressAt: 0,
    lastLoadMoreClickAt: 0,
    timer: null,
    progressTimer: null,
    observer: null,
    stopReason: null,
  };

  const emit = (type, extra = {}) => {
    if (!state.requestId && type !== 'WARSNEAKS_META_SCANNER_READY') return;
    window.postMessage({ source: 'warsneaks-meta-scanner', type, requestId: state.requestId, count: state.ads.length, scrollCount: state.scrollCount, ...extra }, window.location.origin);
  };

  const clean = value => String(value || '').trim().replace(/\s+/g, ' ');

  function findCards() {
    const idPattern = /(?:ID Galeri|Library ID):\s*\d+/i;
    const elements = [...document.querySelectorAll('div, span')].filter(element => {
      const text = clean(element.textContent);
      return idPattern.test(text) && ![...element.children].some(child => idPattern.test(clean(child.textContent)));
    });
    const cards = [];
    for (const element of elements) {
      let candidate = element;
      for (let depth = 0; depth < 14 && candidate.parentElement; depth++) {
        candidate = candidate.parentElement;
        const text = candidate.innerText || candidate.textContent || '';
        const ids = [...new Set((text.match(/(?:ID Galeri|Library ID):\s*\d+/gi) || []).map(value => value.match(/\d+/)?.[0]))];
        if (/Lihat Detail Iklan|See ad details/i.test(text) && ids.length === 1 && text.length > 100 && text.length < 20000) {
          if (!cards.includes(candidate)) cards.push(candidate);
          break;
        }
      }
    }
    return cards;
  }

  function extractAd(card) {
    const text = (card.innerText || card.textContent || '').replace(/\u200b/g, '').trim();
    const libraryId = text.match(/(?:ID Galeri|Library ID):\s*(\d+)/i)?.[1];
    if (!libraryId) return null;
    const lines = text.split(/\n+/).map(clean).filter(Boolean);
    const detailIndex = lines.findIndex(line => /Lihat Detail Iklan|See ad details/i.test(line));
    const sponsorIndex = lines.findIndex((line, index) => index > detailIndex && /^(?:Bersponsor|Sponsored)$/i.test(line));
    const links = [...card.querySelectorAll('a[href]')];
    const advertiserLink = links.find(link => /facebook\.com/i.test(link.href) && !/l\.facebook\.com|ads\/library/i.test(link.href));
    const destinationLink = links.find(link => /l\.facebook\.com\/l\.php/i.test(link.href) || (!/facebook\.com|fb\.com/i.test(link.hostname) && /^https?:/i.test(link.href)));
    let landingPageUrl = '';
    if (destinationLink) {
      try { const url = new URL(destinationLink.href); landingPageUrl = url.hostname === 'l.facebook.com' ? url.searchParams.get('u') || '' : url.href; } catch {}
    }
    const ctaPattern = /^(?:Shop Now|Belanja Sekarang|Pesan sekarang|Learn More|Pelajari Selengkapnya|Sign Up|Daftar|Chat now)$/i;
    const ctaText = lines.find(line => ctaPattern.test(line)) || '';
    const contentStart = sponsorIndex >= 0 ? sponsorIndex + 1 : Math.max(0, detailIndex + 2);
    const contentLines = lines.slice(contentStart).filter(line => !/^(?:Aktif|Active|Platform|Buka Menu Pilihan)$/i.test(line));
    const headline = contentLines.find(line => line.length > 3 && line.length < 180 && !ctaPattern.test(line)) || '';
    const body = contentLines.filter(line => line !== headline && !ctaPattern.test(line)).slice(0, 20).join('\n').slice(0, 3000);
    const duplicateMatch = text.match(/(\d+)\s+(?:iklan|ads?)\s+(?:menggunakan|use|are using)/i);
    const platformAlts = [...card.querySelectorAll('img[alt]')].map(image => image.alt).filter(alt => /Facebook|Instagram|Messenger|Audience Network/i.test(alt));
    return {
      libraryId,
      adId: libraryId,
      pageName: clean(advertiserLink?.textContent || (detailIndex >= 0 ? lines[detailIndex + 1] : '') || 'Unknown advertiser'),
      advertiserName: clean(advertiserLink?.textContent || ''),
      advertiserUrl: advertiserLink?.href || '',
      adText: body,
      adHeadline: headline,
      ctaText,
      landingPageUrl,
      startedRunningAt: text.match(/(?:Mulai dijalankan pada|Started running on)\s+([^\n]+)/i)?.[1] || '',
      isActive: /\b(?:Aktif|Active)\b/i.test(text),
      platforms: [...new Set(platformAlts)],
      duplicateCount: duplicateMatch ? Number(duplicateMatch[1]) : 1,
      scrapedAt: new Date().toISOString(),
    };
  }

  function collect() {
    const seen = new Set(state.ads.map(ad => ad.libraryId));
    for (const card of findCards()) {
      const ad = extractAd(card);
      if (!ad || seen.has(ad.libraryId) || state.ads.length >= state.targetCount) continue;
      state.ads.push(ad);
      seen.add(ad.libraryId);
    }
    if (state.ads.length !== state.lastCount) {
      state.lastCount = state.ads.length;
      state.lastProgressAt = Date.now();
    }
  }

  function finish(reason) {
    if (state.stopReason) return;
    collect();
    state.stopReason = reason;
    state.scanning = false;
    if (state.timer) clearInterval(state.timer);
    if (state.progressTimer) clearTimeout(state.progressTimer);
    if (state.observer) state.observer.disconnect();
    emit('WARSNEAKS_META_SCAN_COMPLETED', { ads: state.ads.slice(0, state.targetCount), stopReason: reason });
  }

  function start(targetCount, requestId) {
    if (state.timer) clearInterval(state.timer);
    if (state.progressTimer) clearTimeout(state.progressTimer);
    if (state.observer) state.observer.disconnect();
    state.ads = [];
    state.scanning = true;
    state.targetCount = Math.min(500, Math.max(10, Number(targetCount) || 100));
    state.requestId = requestId;
    state.scrollCount = 0;
    state.lastCount = 0;
    state.lastProgressAt = Date.now();
    state.lastLoadMoreClickAt = 0;
    state.stopReason = null;
    const begin = () => {
      if (!state.scanning) return;
      collect();
      emit('WARSNEAKS_META_SCAN_PROGRESS');
      state.observer = new MutationObserver(() => {
        if (!state.scanning) return;
        if (state.progressTimer) clearTimeout(state.progressTimer);
        state.progressTimer = setTimeout(() => {
          collect();
          emit('WARSNEAKS_META_SCAN_PROGRESS');
          if (state.ads.length >= state.targetCount) finish('target_reached');
        }, 300);
      });
      state.observer.observe(document.body, { childList: true, subtree: true });
      state.timer = setInterval(() => {
        if (!state.scanning) return;
        collect();
        emit('WARSNEAKS_META_SCAN_PROGRESS');
        if (state.ads.length >= state.targetCount) return finish('target_reached');
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
        if (atBottom) {
          const loadMore = [...document.querySelectorAll('[role="button"]')].find(element => /^(?:Lihat lebih banyak|See more)$/i.test(clean(element.textContent)));
          if (loadMore && Date.now() - state.lastLoadMoreClickAt > 3000) { state.lastLoadMoreClickAt = Date.now(); loadMore.click(); }
        }
        window.scrollBy({ top: Math.max(500, window.innerHeight * 0.75), behavior: 'smooth' });
        state.scrollCount++;
        if (Date.now() - state.lastProgressAt >= 20000) finish('no_new_results');
      }, 900);
    };
    if (document.body) begin(); else window.addEventListener('DOMContentLoaded', begin, { once: true });
  }

  window.__warsneaksBrowserScanner = {
    start,
    stop: (reason = 'user_requested') => finish(reason),
    getAds: () => state.ads,
    getState: () => ({
      scanning: state.scanning,
      requestId: state.requestId,
      count: state.ads.length,
      scrollCount: state.scrollCount,
      stopReason: state.stopReason,
    }),
  };
  window.addEventListener('message', event => {
    const message = event.data;
    if (event.source !== window || message?.source !== 'warsneaks-extension-control') return;
    if (message.type === 'WARSNEAKS_SCANNER_PING') emit('WARSNEAKS_META_SCANNER_READY', { requestId: message.requestId });
    if (message.type === 'WARSNEAKS_START_SCANNER') { start(message.targetCount, message.requestId); emit('WARSNEAKS_META_SCANNER_CONTROLLED', { requestId: message.requestId }); }
    if (message.type === 'WARSNEAKS_STOP_SCANNER') { state.requestId = message.requestId; finish('user_requested'); emit('WARSNEAKS_META_SCANNER_CONTROLLED', { requestId: message.requestId }); }
  });
  const params = new URLSearchParams(window.location.hash.slice(1));
  const autoRequestId = params.get('warsneaks_request');
  if (autoRequestId?.startsWith('browser-')) start(params.get('warsneaks_target'), autoRequestId);
})();
