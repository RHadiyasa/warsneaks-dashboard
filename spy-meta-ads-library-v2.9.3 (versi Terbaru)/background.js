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
});

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
    lastScrollHeight: 0
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
      const allDivs = document.querySelectorAll('div');
      const cards = [];
      
      allDivs.forEach(div => {
        try {
          const text = div.textContent || '';
          
          const hasDuplicateIndicator = 
            text.includes('iklan menggunakan materi iklan dan teks ini') ||
            text.includes('iklan menggunakan materi iklan') ||
            text.includes('ads use this creative and text') ||
            text.includes('ads are using the same creative');
          
          if (hasDuplicateIndicator) {
            let candidate = div;
            for (let i = 0; i < 8; i++) {
              if (!candidate.parentElement) break;
              candidate = candidate.parentElement;
              
              const candidateText = candidate.textContent || '';
              
              const hasGalleryId = candidateText.includes('ID Galeri') || candidateText.includes('Library ID');
              const hasStatus = candidateText.includes('Aktif') || candidateText.includes('Active');
              const hasMinLength = candidateText.length > 200;
              const hasMaxLength = candidateText.length < 10000;
              
              if ((hasGalleryId || hasStatus) && hasMinLength && hasMaxLength && !cards.includes(candidate)) {
                cards.push(candidate);
                break;
              }
            }
          }
        } catch (e) {}
      });
      
      const seen = new Set(scanner.ads.map(a => a._hash));
      let newCount = 0;
      
      cards.forEach(card => {
        try {
          const data = extractAdData(card);
          if (data && !seen.has(data._hash)) {
            scanner.ads.push(data);
            seen.add(data._hash);
            newCount++;
          }
        } catch (e) {}
      });
      
      return newCount;
    } catch (e) {
      return 0;
    }
  }
  
  scanner.start = function(enableAutoScroll = false) {
    scanner.scanning = true;
    scanner.autoScrolling = enableAutoScroll;
    scan();
    
    if (scanner.observer) scanner.observer.disconnect();
    
    scanner.observer = new MutationObserver(() => {
      if (!scanner.scanning) return;
      clearTimeout(window.__scanTimer);
      window.__scanTimer = setTimeout(scan, 500);
    });
    
    scanner.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // AUTO-SCROLL FUNCTIONALITY
    if (enableAutoScroll) {
      scanner.lastScrollHeight = 0;
      
      scanner.scrollInterval = setInterval(() => {
        if (!scanner.scanning || !scanner.autoScrolling) {
          clearInterval(scanner.scrollInterval);
          return;
        }
        
        const currentScrollHeight = document.documentElement.scrollHeight;
        const scrollPosition = window.pageYOffset + window.innerHeight;
        
        // Check if we've reached the bottom
        if (scrollPosition >= document.documentElement.scrollHeight - 100) {
          // Wait a bit for new content to load
          setTimeout(() => {
            const newScrollHeight = document.documentElement.scrollHeight;
            
            // If no new content loaded after 2 seconds, we're done
            if (newScrollHeight === scanner.lastScrollHeight) {
              scanner.autoScrolling = false;
              clearInterval(scanner.scrollInterval);
              console.log('[Auto-Scroll] Reached end of page');
            } else {
              scanner.lastScrollHeight = newScrollHeight;
            }
          }, 2000);
        }
        
        // Smooth scroll down
        window.scrollBy({
          top: 300, // Scroll 300px at a time
          behavior: 'smooth'
        });
        
      }, 1000); // Scroll every 1 second
    }
  };
  
  scanner.stop = function() {
    scanner.scanning = false;
    scanner.autoScrolling = false;
    
    if (scanner.observer) scanner.observer.disconnect();
    
    if (scanner.scrollInterval) {
      clearInterval(scanner.scrollInterval);
      scanner.scrollInterval = null;
    }
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
});
