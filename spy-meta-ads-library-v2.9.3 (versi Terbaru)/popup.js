// Popup Script - v2.6 Programmatic Injection

let currentTab = null;
let isScanning = false;
let totalAds = 0;
let checkInterval = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  const pageCheck = document.getElementById('page-check');
  const mainUI = document.getElementById('main-ui');

  if (!tab.url || !tab.url.includes('facebook.com/ads/library')) {
    pageCheck.className = 'page-check error';
    pageCheck.innerHTML = `
      ❌ Buka halaman <strong>Facebook Ads Library</strong> dulu<br>
      <small>facebook.com/ads/library</small>
    `;
    return;
  }

  pageCheck.style.display = 'none';
  mainUI.style.display = 'block';

  const stored = await chrome.storage.local.get(['adsData']);
  if (stored.adsData && stored.adsData.length > 0) {
    totalAds = stored.adsData.length;
    updateCount(totalAds);
    setStatus(`${totalAds} iklan tersimpan - siap dibuka!`);
    // Show dashboard button directly
    document.getElementById('btn-open-dash').style.display = 'block';
    document.getElementById('btn-open-dash').disabled = false;
    // Hide analyze (not needed)
    document.getElementById('btn-analyze').style.display = 'none';
  }
}

function updateCount(count) {
  document.getElementById('count-badge').textContent = count;
  totalAds = count;
}

function setStatus(text) {
  const dot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  
  dot.className = 'status-dot' + (isScanning ? ' active' : '');
  statusText.innerHTML = text;
}

// Start button
document.getElementById('btn-start').addEventListener('click', async () => {
  if (!currentTab) return;
  
  try {
    // Get auto-scroll preference
    const autoScrollEnabled = document.getElementById('auto-scroll-toggle').checked;
    
    setStatus('Mempersiapkan...');
    
    // Inject script programmatically
    await chrome.runtime.sendMessage({
      type: 'INJECT_SCRIPT',
      tabId: currentTab.id
    });
    
    // Wait a bit for injection
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Start scanning with auto-scroll parameter
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: (enableAutoScroll) => {
        if (window.__adsScanner) {
          window.__adsScanner.start(enableAutoScroll);
        }
      },
      args: [autoScrollEnabled],
      world: 'MAIN'
    });
    
    isScanning = true;
    
    if (autoScrollEnabled) {
      setStatus('🚀 Auto-scrolling & scanning...');
    } else {
      setStatus('Scanning... scroll halaman ke bawah');
    }
    
    // Show stop button, hide start button
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-stop').style.display = 'block';
    document.getElementById('btn-stop').disabled = false;
    
    // Poll for ads count
    startPolling();
    
  } catch (err) {
    setStatus('Error: ' + err.message);
  }
});

// Stop button
document.getElementById('btn-stop').addEventListener('click', async () => {
  console.log('[Popup] Stop button clicked!'); // Debug
  
  if (!currentTab) {
    console.log('[Popup] No current tab');
    return;
  }
  
  // Immediate UI feedback
  document.getElementById('btn-stop').disabled = true;
  setStatus('Menghentikan scan...');
  
  try {
    console.log('[Popup] Executing stop on tab:', currentTab.id);
    
    // Stop scanning
    const stopResult = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        console.log('[Page] Stop called');
        if (window.__adsScanner) {
          window.__adsScanner.stop();
          console.log('[Page] Scanner stopped');
          return true;
        }
        console.log('[Page] No scanner found');
        return false;
      },
      world: 'MAIN'
    });
    
    console.log('[Popup] Stop result:', stopResult);
    
    isScanning = false;
    stopPolling();
    
    // Get final count and AUTO-SAVE
    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        if (window.__adsScanner) {
          return window.__adsScanner.getAds();
        }
        return [];
      },
      world: 'MAIN'
    });
    
    const ads = results[0]?.result || [];
    const finalCount = ads.length;
    console.log('[Popup] Final count:', finalCount);
    console.log('[Popup] Ads data:', ads);
    
    // AUTO-SAVE to storage
    if (finalCount > 0) {
      await chrome.storage.local.set({ adsData: ads });
      console.log('[Popup] Data auto-saved to storage');
    }
    
    updateCount(finalCount);
    
    document.getElementById('btn-stop').style.display = 'none';
    document.getElementById('btn-start').style.display = 'block';
    document.getElementById('btn-stop').disabled = false;
    
    // Enable dashboard button DIRECTLY (skip Analyze)
    if (finalCount > 0) {
      setStatus(`Scan selesai - ${finalCount} iklan tersimpan!`);
      document.getElementById('btn-open-dash').style.display = 'block';
      document.getElementById('btn-open-dash').disabled = false;
      console.log('[Popup] Dashboard button enabled - ready to open!');
      
      // Hide analyze button (not needed anymore)
      document.getElementById('btn-analyze').style.display = 'none';
    } else {
      setStatus('Scan dihentikan - tidak ada iklan duplicate ditemukan');
      console.log('[Popup] No ads found');
    }
    
  } catch (err) {
    console.error('[Popup] Stop error:', err);
    setStatus('Error: ' + err.message);
    document.getElementById('btn-stop').disabled = false;
  }
});

// Analyze button - Just verify data and show dashboard button
document.getElementById('btn-analyze').addEventListener('click', async () => {
  console.log('[Popup] Analyze button clicked');
  
  try {
    // Verify data exists in storage
    const stored = await chrome.storage.local.get(['adsData']);
    const ads = stored.adsData || [];
    
    console.log('[Popup] Stored ads count:', ads.length);
    
    if (ads.length === 0) {
      setStatus('Tidak ada iklan tersimpan');
      return;
    }
    
    // Data already saved, just show success
    updateCount(ads.length);
    setStatus(`${ads.length} iklan siap dianalisis!`);
    document.getElementById('btn-open-dash').style.display = 'block';
    
    console.log('[Popup] Ready to open dashboard');
    
  } catch (err) {
    console.error('[Popup] Analyze error:', err);
    setStatus('Error: ' + err.message);
  }
});

// Open dashboard
document.getElementById('btn-open-dash').addEventListener('click', () => {
  console.log('[Popup] Opening dashboard...');
  chrome.tabs.create({ url: 'dashboard.html' });
});

// Clear data
document.getElementById('btn-clear').addEventListener('click', async () => {
  if (!confirm('Hapus semua data iklan yang tersimpan?')) return;
  
  try {
    // Clear storage
    await chrome.storage.local.set({ adsData: [] });
    
    // Clear scanner
    if (currentTab) {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => {
          if (window.__adsScanner) {
            window.__adsScanner.clear();
          }
        },
        world: 'MAIN'
      });
    }
    
    updateCount(0);
    setStatus('Data dihapus');
    
    document.getElementById('btn-analyze').disabled = true;
    document.getElementById('btn-open-dash').style.display = 'none';
    
  } catch (err) {
    setStatus('Error: ' + err.message);
  }
});

// Polling function
function startPolling() {
  stopPolling();
  
  checkInterval = setInterval(async () => {
    if (!currentTab || !isScanning) {
      stopPolling();
      return;
    }
    
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => {
          if (window.__adsScanner) {
            return window.__adsScanner.getAds().length;
          }
          return 0;
        },
        world: 'MAIN'
      });
      
      const count = results[0]?.result || 0;
      
      if (count !== totalAds) {
        updateCount(count);
        setStatus(`Scanning... ${count} iklan ditemukan`);
      }
      
    } catch (err) {
      // Ignore polling errors
    }
  }, 1000);
}

function stopPolling() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// Initialize
init();
