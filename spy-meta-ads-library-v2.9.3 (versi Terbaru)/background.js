// Enable side panel when extension icon is clicked
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

chrome.runtime.onStartup?.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

// v2.7 COMPLETE - Programmatic Injection + Full Extraction
let injectedTabs = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_SCRIPT') {
    injectContentScript(message.tabId)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.type === 'WARSNEAKS_START_META_SCAN') {
    startDashboardScan(message, sender)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message || 'BROWSER_SCAN_START_FAILED' }));
    return true;
  }
  if (message.type === 'WARSNEAKS_STOP_META_SCAN') {
    stopDashboardScan(message.requestId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message || 'BROWSER_SCAN_STOP_FAILED' }));
    return true;
  }
  if (message.type === 'WARSNEAKS_META_SCAN_EVENT') {
    forwardScanEvent(message.event, sender.tab?.id).catch(() => {});
    sendResponse({ success: true });
    return;
  }
  if (message.type === 'WARSNEAKS_GET_TAB_SCAN') {
    getTabScan(sender.tab?.id).then(result => sendResponse(result)).catch(() => sendResponse(null));
    return true;
  }
  if (message.type === 'WARSNEAKS_EXTENSION_PING') {
    sendResponse({ success: true, version: chrome.runtime.getManifest().version });
  }
});

const scanStateKey = requestId => `warsneaks-meta-scan:${requestId}`;
const tabStateKey = tabId => `warsneaks-meta-tab:${tabId}`;

async function getTabScan(tabId) {
  if (!tabId) return null;
  return (await chrome.storage.session.get(tabStateKey(tabId)))[tabStateKey(tabId)] || null;
}

function assertDashboardSender(sender) {
  const url = new URL(sender.tab?.url || '');
  const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(url.hostname) && ['3000', '3001'].includes(url.port);
  const allowed = url.hostname === 'warsneaks.ravisa.space' || isLocalDevelopment;
  if (!allowed || !sender.tab?.id) throw new Error('DASHBOARD_ORIGIN_NOT_ALLOWED');
  return sender.tab.id;
}

function assertMetaAdsUrl(value) {
  const url = new URL(value);
  if (!['www.facebook.com', 'web.facebook.com'].includes(url.hostname) || !url.pathname.startsWith('/ads/library/')) throw new Error('INVALID_META_ADS_URL');
  return url.href;
}

function isMetaAdsUrl(value) {
  try {
    const url = new URL(value);
    return ['www.facebook.com', 'web.facebook.com'].includes(url.hostname) && url.pathname.startsWith('/ads/library/');
  } catch {
    return false;
  }
}

async function startDashboardScan(message, sender) {
  const dashboardTabId = assertDashboardSender(sender);
  const requestId = String(message.requestId || '');
  if (!requestId.startsWith('browser-')) throw new Error('INVALID_SCAN_REQUEST');
  const targetCount = Math.min(500, Math.max(10, Number(message.targetCount) || 100));
  const tab = await chrome.tabs.create({ url: assertMetaAdsUrl(message.url), active: true, openerTabId: dashboardTabId });
  if (!tab.id) throw new Error('META_TAB_CREATE_FAILED');
  const scanState = { requestId, dashboardTabId, metaTabId: tab.id, targetCount };
  await chrome.storage.session.set({ [scanStateKey(requestId)]: scanState, [tabStateKey(tab.id)]: scanState });
  await chrome.tabs.sendMessage(dashboardTabId, { source: 'warsneaks-extension', type: 'WARSNEAKS_META_SCAN_STARTED', requestId, metaTabId: tab.id });
  return { success: true, requestId, metaTabId: tab.id };
}

async function stopDashboardScan(requestId) {
  const key = scanStateKey(requestId);
  const state = (await chrome.storage.session.get(key))[key];
  if (!state) throw new Error('BROWSER_SCAN_NOT_FOUND');
  await chrome.tabs.sendMessage(state.metaTabId, { type: 'WARSNEAKS_STOP_SCANNER', requestId });
  return { success: true };
}

async function forwardScanEvent(event, metaTabId) {
  const requestId = String(event?.requestId || '');
  const key = scanStateKey(requestId);
  const state = (await chrome.storage.session.get(key))[key];
  if (!state || state.metaTabId !== metaTabId) return;
  const terminal = ['WARSNEAKS_META_SCAN_COMPLETED', 'WARSNEAKS_META_SCAN_ERROR'].includes(event.type);
  try {
    await chrome.tabs.sendMessage(state.dashboardTabId, { ...event, source: 'warsneaks-extension' });
  } finally {
    if (terminal) {
      await chrome.storage.session.remove([key, tabStateKey(state.metaTabId)]);
      await chrome.tabs.update(state.dashboardTabId, { active: true }).catch(() => {});
    }
  }
}

async function handleClosedMetaTab(tabId) {
  const state = await getTabScan(tabId);
  if (!state) return;
  await chrome.storage.session.remove([scanStateKey(state.requestId), tabStateKey(tabId)]);
  await chrome.tabs.sendMessage(state.dashboardTabId, {
    source: 'warsneaks-extension',
    type: 'WARSNEAKS_META_SCAN_ERROR',
    requestId: state.requestId,
    error: 'META_TAB_CLOSED',
  }).catch(() => {});
}

async function handleMetaTabNavigation(tabId, url) {
  const state = await getTabScan(tabId);
  if (!state || isMetaAdsUrl(url)) return;
  await chrome.storage.session.remove([scanStateKey(state.requestId), tabStateKey(tabId)]);
  await chrome.tabs.sendMessage(state.dashboardTabId, {
    source: 'warsneaks-extension',
    type: 'WARSNEAKS_META_SCAN_ERROR',
    requestId: state.requestId,
    error: 'META_TAB_NAVIGATED',
  }).catch(() => {});
}

async function injectContentScript(tabId) {
  if (injectedTabs.has(tabId)) return;
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: initScanner,
      world: 'MAIN'
    });
    injectedTabs.add(tabId);
  } catch (err) {
    throw err;
  }
}

function initScanner() {
  if (window.__adsScanner) return;
  
  window.__adsScanner = { 
    ads: [], 
    scanning: false, 
    observer: null,
    autoScrolling: false,
    scrollInterval: null,
    lastScrollHeight: 0,
    lastProgressAt: 0,
    lastCount: 0,
    lastLoadMoreClickAt: 0,
    targetCount: 100,
    scrollCount: 0,
    requestId: null,
    stopReason: null
  };
  const scanner = window.__adsScanner;
  
  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }
  
  function extractAdData(card) {
    try {
      const cardText = card.textContent;
      
      // Duplicate count
      let duplicateCount = 1;
      const countPatterns = [
        /(\d+)\s+iklan\s+menggunakan\s+materi\s+iklan\s+dan\s+teks\s+ini/i,
        /(\d+)\s+ads?\s+use\s+this\s+creative\s+and\s+text/i,
        /(\d+)\s+ads?\s+are\s+using\s+the\s+same\s+creative/i
      ];
      
      for (const pattern of countPatterns) {
        const match = cardText.match(pattern);
        if (match) {
          duplicateCount = parseInt(match[1]);
          break;
        }
      }
      
      // Advertiser
      let advertiserName = 'Unknown';
      let advertiserUrl = '';
      let advertiserAvatarUrl = '';
      let advertiserStatus = '';
      
      const statusBadge = card.querySelector('[role="img"], span[aria-label]');
      if (statusBadge) {
        const ariaLabel = statusBadge.getAttribute('aria-label') || '';
        if (ariaLabel.toLowerCase().includes('aktif') || ariaLabel.toLowerCase().includes('active')) {
          advertiserStatus = 'Aktif';
        }
      }
      
      const allImages = card.querySelectorAll('img');
      for (const img of allImages) {
        if (img.width <= 100 && img.height <= 100 && img.src) {
          advertiserAvatarUrl = img.src;
          break;
        }
      }
      
      const allLinks = card.querySelectorAll('a');
      for (const link of allLinks) {
        const href = link.href || '';
        if (!href.includes('/ads/library') && href.includes('facebook.com')) {
          const txt = link.textContent.trim();
          if (txt.length > 2 && txt.length < 100) {
            advertiserName = txt;
            advertiserUrl = href;
            break;
          }
        }
      }
      
      if (advertiserName === 'Unknown') {
        const strongEls = card.querySelectorAll('strong, b, h3');
        for (const el of strongEls) {
          const text = el.textContent.trim();
          if (text.length > 3 && text.length < 100 && !text.includes('iklan')) {
            advertiserName = text;
            break;
          }
        }
      }
      
      // Date
      let startDate = '';
      const datePatterns = [
        /Mulai\s+dijalankan\s+pada\s+([\d\s\w]+\d{4})/i,
        /Started\s+running\s+on\s+([\d\s\w]+\d{4})/i,
        /(\d{1,2}\s+\w+\s+\d{4})/
      ];
      
      for (const pattern of datePatterns) {
        const match = cardText.match(pattern);
        if (match) {
          startDate = match[1] || match[0];
          break;
        }
      }
      
      // Ad text - IMPROVED: Ambil SEMUA teks iklan (multi-paragraph)
      let adText = '';
      const textParts = [];
      
      // Strategi 1: Ambil semua div dengan dir="auto" yang berisi teks iklan
      const textCandidates = card.querySelectorAll('div[dir="auto"]');
      for (const div of textCandidates) {
        const text = div.textContent.trim();
        
        // Filter: hanya ambil text yang panjang dan bukan metadata
        if (text.length > 15 && 
            !text.includes('iklan menggunakan materi') &&
            !text.includes('ads use this') &&
            !text.includes('ID Galeri') &&
            !text.includes('Library ID') &&
            !text.includes('Mulai dijalankan') &&
            !text.includes('Started running') &&
            !text.includes('Lihat Detail') &&
            !text.includes('See Details') &&
            !text.toLowerCase().includes('bersponsor') &&
            !text.toLowerCase().includes('sponsored')) {
          
          // Cek apakah text ini belum ada di array (avoid duplicate)
          const isDuplicate = textParts.some(existing => {
            return existing.includes(text) || text.includes(existing);
          });
          
          if (!isDuplicate) {
            textParts.push(text);
          }
        }
      }
      
      // Gabungkan semua text parts dengan line break
      if (textParts.length > 0) {
        adText = textParts.join('\n\n');
      }
      
      // Strategi 2: Kalau masih kosong, coba cari text panjang di mana aja
      if (!adText) {
        const allDivs = card.querySelectorAll('div');
        for (const div of allDivs) {
          const text = div.textContent.trim();
          if (text.length > 50 && text.length < 3000 &&
              !text.includes('iklan menggunakan') &&
              !text.includes('ID Galeri')) {
            adText = text;
            break;
          }
        }
      }
      
      // ID
      let adId = '';
      const idPatterns = [
        /ID\s+Galeri[:\s]+(\d+)/i,
        /Library\s+ID[:\s]+(\d+)/i
      ];
      
      for (const pattern of idPatterns) {
        const match = cardText.match(pattern);
        if (match) {
          adId = match[1];
          break;
        }
      }
      
      if (!adId) {
        adId = 'ad-' + Math.abs(hashCode(advertiserName + adText.substring(0, 50) + duplicateCount)).toString();
      }
      
      // Platforms
      let platforms = [];
      const platformIcons = card.querySelectorAll('img[alt*="Facebook"], img[alt*="Instagram"]');
      platformIcons.forEach(icon => {
        const alt = icon.alt || '';
        if (alt.includes('Facebook')) platforms.push('Facebook');
        if (alt.includes('Instagram')) platforms.push('Instagram');
      });
      platforms = [...new Set(platforms)];
      
      // Headline - ambil dari text pertama kalau udah ada textParts
      let adHeadline = '';
      if (textParts.length > 0) {
        adHeadline = textParts[0]; // Text pertama biasanya headline
      } else {
        // Fallback: cari headline manual
        const headlineCandidates = card.querySelectorAll('span, div');
        for (const el of headlineCandidates) {
          const text = el.textContent.trim();
          if (text.length > 10 && text.length < 150 && 
              !text.includes('iklan menggunakan')) {
            adHeadline = text;
            break;
          }
        }
      }
      
      // Media
      let mediaUrls = [];
      let videoSourceUrl = '';
      let mediaType = 'unknown';
      
      const videoEl = card.querySelector('video');
      if (videoEl) {
        mediaType = 'video';
        
        // Try multiple methods to get video URL
        // Method 1: src attribute
        if (videoEl.src && !videoEl.src.includes('blob:')) {
          videoSourceUrl = videoEl.src;
        }
        
        // Method 2: source tag
        if (!videoSourceUrl) {
          const sourceEl = videoEl.querySelector('source');
          if (sourceEl && sourceEl.src && !sourceEl.src.includes('blob:')) {
            videoSourceUrl = sourceEl.src;
          }
        }
        
        // Method 3: data attributes
        if (!videoSourceUrl) {
          const dataSrc = videoEl.getAttribute('data-src') || 
                         videoEl.getAttribute('data-video-url');
          if (dataSrc) videoSourceUrl = dataSrc;
        }
        
        // Get poster/thumbnail
        if (videoEl.poster) mediaUrls.push(videoEl.poster);
        
        // Note: Facebook videos often use blob URLs which can't be downloaded
        // We'll save the poster image as fallback
      } else {
        mediaType = 'image';
      }
      
      allImages.forEach(img => {
        const src = img.src;
        if (src && !src.includes('static') && img.width > 100 && !mediaUrls.includes(src)) {
          mediaUrls.push(src);
        }
      });
      
      // Landing page
      let landingPageUrl = '';
      let landingDomain = '';
      let ctaText = '';
      
      const externalLinks = card.querySelectorAll('a[href*="l.facebook.com"]');
      for (const link of externalLinks) {
        try {
          const urlObj = new URL(link.href);
          const actualUrl = urlObj.searchParams.get('u');
          if (actualUrl) {
            landingPageUrl = decodeURIComponent(actualUrl);
            try {
              landingDomain = new URL(landingPageUrl).hostname.replace('www.', '');
            } catch (e) {}
            const linkText = link.textContent.trim();
            if (linkText && linkText.length < 50) ctaText = linkText;
            break;
          }
        } catch (e) {}
      }
      
      if (!ctaText) {
        const buttons = card.querySelectorAll('div[role="button"]');
        for (const btn of buttons) {
          const text = btn.textContent.trim();
          if (text && text !== 'Lihat Detail' && text.length > 2 && text.length < 50) {
            ctaText = text;
            break;
          }
        }
      }
      
      return {
        adId,
        duplicateCount,
        advertiserName: advertiserName.replace(/\n/g, ' ').trim(),
        advertiserUrl,
        advertiserAvatarUrl,
        advertiserStatus,
        adHeadline: adHeadline.substring(0, 300),
        adText: adText.substring(0, 1000),
        startDate,
        platforms: platforms.join(', '),
        mediaUrls,
        videoSourceUrl,
        mediaType,
        videoDuration: '',
        landingPageUrl,
        landingDomain,
        ctaText,
        rating: '',
        scrapedAt: new Date().toISOString(),
        _hash: `${adId}_${advertiserName}_${duplicateCount}`
      };
    } catch (e) {
      return null;
    }
  }
  
  function scan() {
    try {
      const idPattern = /(?:ID Galeri|Library ID):\s*\d+/i;
      const idElements = [...document.querySelectorAll('div, span')].filter(element => {
        const text = (element.textContent || '').trim();
        return idPattern.test(text) && ![...element.children].some(child => idPattern.test((child.textContent || '').trim()));
      });
      const cards = [];
      idElements.forEach(element => {
        let candidate = element;
        for (let i = 0; i < 14 && candidate.parentElement; i++) {
          candidate = candidate.parentElement;
          const text = candidate.textContent || '';
          const ids = [...new Set((text.match(/(?:ID Galeri|Library ID):\s*\d+/gi) || []).map(value => value.match(/\d+/)?.[0]))];
          const hasDetails = /Lihat Detail Iklan|See ad details/i.test(text);
          if (hasDetails && ids.length === 1 && text.length > 100 && text.length < 20000) {
            if (!cards.includes(candidate)) cards.push(candidate);
            break;
          }
        }
      });

      const seen = new Set(scanner.ads.map(ad => ad.adId));
      let newCount = 0;
      cards.forEach(card => {
        try {
          const data = extractAdData(card);
          if (data && !seen.has(data.adId) && scanner.ads.length < scanner.targetCount) {
            scanner.ads.push(data);
            seen.add(data.adId);
            newCount++;
          }
        } catch (e) {}
      });
      if (scanner.ads.length !== scanner.lastCount) {
        scanner.lastCount = scanner.ads.length;
        scanner.lastProgressAt = Date.now();
      }
      return newCount;
    } catch (e) {
      return 0;
    }
  }
  
  function emit(type, extra = {}) {
    if (!scanner.requestId) return;
    window.postMessage({ source: 'warsneaks-meta-scanner', type, requestId: scanner.requestId, count: scanner.ads.length, scrollCount: scanner.scrollCount, ...extra }, window.location.origin);
  }

  function finish(reason) {
    if (scanner.stopReason) return;
    scan();
    scanner.stopReason = reason;
    scanner.scanning = false;
    scanner.autoScrolling = false;
    if (scanner.observer) scanner.observer.disconnect();
    if (scanner.scrollInterval) clearInterval(scanner.scrollInterval);
    scanner.scrollInterval = null;
    emit('WARSNEAKS_META_SCAN_COMPLETED', { ads: scanner.ads.slice(0, scanner.targetCount), stopReason: reason });
  }

  scanner.start = function(enableAutoScroll = false, targetCount = 100, requestId = null) {
    if (scanner.scrollInterval) clearInterval(scanner.scrollInterval);
    if (scanner.observer) scanner.observer.disconnect();
    scanner.ads = [];
    scanner.scanning = true;
    scanner.autoScrolling = enableAutoScroll;
    scanner.targetCount = Math.min(500, Math.max(10, Number(targetCount) || 100));
    scanner.requestId = requestId;
    scanner.stopReason = null;
    scanner.scrollCount = 0;
    scanner.lastCount = 0;
    scanner.lastProgressAt = Date.now();
    scanner.lastLoadMoreClickAt = 0;
    scan();
    emit('WARSNEAKS_META_SCAN_PROGRESS');

    scanner.observer = new MutationObserver(() => {
      if (!scanner.scanning) return;
      clearTimeout(window.__scanTimer);
      window.__scanTimer = setTimeout(() => {
        scan();
        emit('WARSNEAKS_META_SCAN_PROGRESS');
        if (scanner.ads.length >= scanner.targetCount) finish('target_reached');
      }, 400);
    });
    scanner.observer.observe(document.body, { childList: true, subtree: true });

    if (enableAutoScroll) {
      scanner.scrollInterval = setInterval(() => {
        if (!scanner.scanning || !scanner.autoScrolling) return;
        scan();
        emit('WARSNEAKS_META_SCAN_PROGRESS');
        if (scanner.ads.length >= scanner.targetCount) return finish('target_reached');
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
        if (atBottom) {
          const loadMore = [...document.querySelectorAll('[role="button"]')].find(element => /^(?:Lihat lebih banyak|See more)$/i.test((element.textContent || '').trim().replace(/\s+/g, ' ')));
          if (loadMore && Date.now() - scanner.lastLoadMoreClickAt > 3000) {
            scanner.lastLoadMoreClickAt = Date.now();
            loadMore.click();
          }
        }
        window.scrollBy({ top: Math.max(500, window.innerHeight * 0.75), behavior: 'smooth' });
        scanner.scrollCount += 1;
        if (Date.now() - scanner.lastProgressAt >= 20000) finish('no_new_results');
      }, 900);
    }
  };

  scanner.stop = function(reason = 'user_requested') {
    finish(reason);
  };
  
  scanner.getAds = function() {
    return scanner.ads;
  };
  
  scanner.clear = function() {
    scanner.ads = [];
  };
  
  window.postMessage({ type: '__ADS_SCANNER_READY' }, '*');
}

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
  handleClosedMetaTab(tabId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) handleMetaTabNavigation(tabId, changeInfo.url).catch(() => {});
});
