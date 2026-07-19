// =====================================================
// Ads Duplicate Dashboard - Main Script
// =====================================================

let rawAds = [];
let advertisers = [];
let filteredAdvertisers = [];

// ---- Init ----
async function init() {
  console.log('[Dashboard] Initializing...');
  
  try {
    // Coba baca dari Chrome storage (saat dijalankan sebagai extension)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      console.log('[Dashboard] Trying chrome.storage...');
      const data = await chrome.storage.local.get(['adsData']);
      if (data.adsData && data.adsData.length > 0) {
        rawAds = data.adsData;
        console.log('[Dashboard] Loaded from chrome.storage:', rawAds.length, 'ads');
        console.log('[Dashboard] Sample ad:', rawAds[0]);
        processData();
        return;
      } else {
        console.log('[Dashboard] No data in chrome.storage');
      }
    }
  } catch (e) {
    console.log('[Dashboard] Chrome storage error:', e);
  }

  // Fallback: cek localStorage (untuk demo / standalone mode)
  console.log('[Dashboard] Trying localStorage...');
  const stored = localStorage.getItem('adsData');
  if (stored) {
    try {
      rawAds = JSON.parse(stored);
      console.log('[Dashboard] Loaded from localStorage:', rawAds.length, 'ads');
      processData();
      return;
    } catch (e) {
      console.error('[Dashboard] localStorage parse error:', e);
    }
  }

  // Demo mode: generate sample data
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === 'true') {
    console.log('[Dashboard] Demo mode activated');
    rawAds = generateDemoData();
    console.log('[Dashboard] Generated demo data:', rawAds.length, 'ads');
    processData();
    return;
  }

  console.log('[Dashboard] No data found, showing empty state');
  showEmpty();
}

// ---- Demo Data Generator ----
function generateDemoData() {
  const advertisers = [
    'Ahli PDKT',
    'Buku 200 Resep Sehat ALAMI JSR',
    'Toko Rezeki Berkah',
    'Warung Rejeki Abadi',
    'Chicken Crunchy Roll',
    'Bank Mega',
    'Kisah Musafir Muslim'
  ];

  const headlines = [
    'Bingung cara deketin cewek lewat chat?',
    'Hidup Sehat itu MUDAH!!',
    'Dapatkan rezeki berlimpah!',
    'PROMO HARI INI SAJA!',
    'PELUANG BISNIS KULINER HITS',
    'Imlek lebih cuan dengan diskon s/d 50%',
    'Banjir, tanah longsor, gempa bumi'
  ];

  const adTexts = [
    'Coba deh ikutin step by step dari ebook Strategi PDKT Lewat Chat 🔥\n\nEbook ini akan merubah total cara lo PDKT sama cewek 😍',
    '😋 sulit banget nemu ritme sehat yang pas\n😥 bingung juga harus makan yang gimana\n🤔 mau apa-apa alami, kayak kurang enak?\n\ntenang, buku 200 Resep Sehat JSR bisa jadi soluannya...',
    'Testimoni nyata dari ribuan pelanggan di seluruh Indonesia. Jangan lewatkan promo spesial hari ini!',
    'Diskon hingga 50% untuk semua produk pilihan. Stok terbatas, buruan order sebelum kehabisan!',
    'Ini dia kemitraan Chicken Crunchy Roll produknya unik, viral, kekinian, laris dipasaran dan sistem operasional yang sudah teruji',
    'Rayakan Imlek dengan diskon s/d 50% Kartu Kredit & Debit Bank Mega di merchant favorit',
    'Apakah manusia semakin jahat sehingga Allah berikan azab untuk menghukumnya? Temukan hidayah di tengah kondisi buruk ini.'
  ];

  const landingUrls = [
    'https://ahlip dkt.com/ebook-strategi',
    'https://bukusehat.com/200-resep-jsr',
    'https://tokorezekirekah.id/promo',
    'https://warungrejeiki.com/flash-sale',
    'https://chickencrunchyroll.com/',
    'https://bankmega.com/id/promo/CNY-2026/',
    'https://kisahmusafir.id/video'
  ];

  const domains = [
    'ahlip dkt.com',
    'bukusehat.com',
    'tokorezekirekah.id',
    'warungrejeiki.com',
    'chickencrunchyroll.com',
    'bankmega.com',
    'kisahmusafir.id'
  ];

  const ctaTexts = [
    'Download Ebook',
    'Pesan Sekarang',
    'Lihat Promo',
    'Belanja Sekarang',
    'Pelajari Lebih Lanjut',
    'Learn More',
    'Tonton Video'
  ];

  const duplicateCounts = [13, 11, 11, 8, 7, 5, 3];
  const ads = [];

  advertisers.forEach((adv, idx) => {
    const dupCount = duplicateCounts[idx];
    const hasVideo = idx % 3 === 0;
    
    ads.push({
      adId: `${1546181596706138 + idx}`,
      duplicateCount: dupCount,
      advertiserName: adv,
      advertiserUrl: `https://facebook.com/${adv.toLowerCase().replace(/\s+/g, '.')}`,
      advertiserAvatarUrl: `https://scontent.fcgk32-1.fna.fbcdn.net/v/t39.35426-6/example${idx}.jpg`,
      advertiserStatus: idx % 2 === 0 ? 'Aktif' : 'Bersponsor',
      adHeadline: headlines[idx],
      adText: adTexts[idx],
      startDate: `${idx + 10} ${['Jan', 'Feb', 'Mar'][idx % 3]} 202${5 + (idx % 2)}`,
      platforms: idx % 3 === 0 ? 'Facebook, Instagram' : idx % 3 === 1 ? 'Facebook' : 'Instagram, Messenger',
      mediaUrls: [
        `https://scontent.fcgk32-1.fna.fbcdn.net/example${idx}_1.jpg`,
        idx % 2 === 0 ? `https://scontent.fcgk32-1.fna.fbcdn.net/example${idx}_2.jpg` : null
      ].filter(Boolean),
      videoSourceUrl: hasVideo ? `https://scontent.fcgk32-1.fna.fbcdn.net/o1/v/t2/f2/example${idx}.mp4` : '',
      mediaType: hasVideo ? 'video' : 'image',
      videoDuration: hasVideo ? ['1:03', '2:52', '0:37'][idx % 3] : '',
      landingPageUrl: landingUrls[idx],
      landingDomain: domains[idx],
      ctaText: ctaTexts[idx],
      rating: idx % 2 === 0 ? '4.9/5.0' : '',
      scrapedAt: new Date().toISOString()
    });
  });

  return ads;
}

// ---- Process raw ads ----
async function processData() {
  if (!rawAds || rawAds.length === 0) {
    showEmpty();
    return;
  }

  console.log('[Dashboard] Processing', rawAds.length, 'ads');

  // Data sudah ter-load semua (termasuk yang non-duplikat)
  advertisers = rawAds;
  
  // Sort by duplicate count descending by default
  advertisers.sort((a, b) => b.duplicateCount - a.duplicateCount);

  console.log('[Dashboard] Sorted advertisers:', advertisers.length);

  showDashboard();
  updateStats();
  applyFilters();
}

// ---- Show/hide states ----
function showEmpty() {
  document.getElementById('empty-state').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('btn-export-csv').style.display = 'inline-flex';
}

// ---- Update stats ----
function updateStats() {
  document.getElementById('stat-total').textContent = rawAds.length.toLocaleString('id');
  
  // Total duplicates (sum of all duplicate counts)
  const totalDuplicates = rawAds.reduce((sum, a) => sum + a.duplicateCount, 0);
  document.getElementById('stat-unique').textContent = totalDuplicates.toLocaleString('id');
  
  // High duplicates (5+)
  const highDup = rawAds.filter(a => a.duplicateCount >= 5).length;
  document.getElementById('stat-dup').textContent = highDup.toLocaleString('id');
  
  // Unique advertisers
  const uniqueAdv = new Set(rawAds.map(a => a.advertiserName).filter(Boolean)).size;
  document.getElementById('stat-dup-ads').textContent = uniqueAdv.toLocaleString('id');

  // Update export date
  if (rawAds.length > 0 && rawAds[0].scrapedAt) {
    const d = new Date(rawAds[0].scrapedAt);
    document.getElementById('export-date').textContent = d.toLocaleString('id-ID');
  }
}

// ---- Apply filters & sorting ----
function applyFilters() {
  const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
  const sortVal = document.getElementById('sort-select').value;
  const minDup = parseInt(document.getElementById('filter-min').value);

  // Filter
  filteredAdvertisers = advertisers.filter(a => {
    if (a.duplicateCount < minDup) return false;
    if (searchVal) {
      const searchTarget = `${a.advertiserName} ${a.adText}`.toLowerCase();
      if (!searchTarget.includes(searchVal)) return false;
    }
    return true;
  });

  // Sort
  filteredAdvertisers.sort((a, b) => {
    switch (sortVal) {
      case 'count-desc': return b.duplicateCount - a.duplicateCount;
      case 'count-asc': return a.duplicateCount - b.duplicateCount;
      case 'name-asc': return a.advertiserName.localeCompare(b.advertiserName);
      case 'name-desc': return b.advertiserName.localeCompare(a.advertiserName);
      default: return b.duplicateCount - a.duplicateCount;
    }
  });

  renderGrid();
}

// ---- Render advertiser cards ----
function renderGrid() {
  const grid = document.getElementById('ads-grid');
  const noResults = document.getElementById('no-results');
  const exportCount = document.getElementById('export-count');

  exportCount.textContent = filteredAdvertisers.length;

  if (filteredAdvertisers.length === 0) {
    grid.innerHTML = '';
    noResults.style.display = 'block';
    return;
  }

  noResults.style.display = 'none';
  
  grid.innerHTML = filteredAdvertisers.map((ad, idx) => {
    // Badge class based on duplicate count
    let badgeClass = 'low';
    if (ad.duplicateCount >= 10) badgeClass = 'high';
    else if (ad.duplicateCount >= 5) badgeClass = 'medium';
    
    const initial = ad.advertiserName.charAt(0).toUpperCase();
    
    // Media rendering with video player + download
    let mediaHtml = '';
    
    // Video player
    if (ad.mediaType === 'video') {
      const safePosterUrl = ad.mediaUrls && ad.mediaUrls[0] ? escapeHtml(ad.mediaUrls[0]) : '';
      
      if (ad.videoSourceUrl && !ad.videoSourceUrl.includes('blob:')) {
        // Has downloadable video URL
        const safeVideoUrl = escapeHtml(ad.videoSourceUrl);
        mediaHtml += `
          <div class="media-item">
            <video controls preload="metadata" poster="${safePosterUrl}" style="max-height: 400px; width: 100%; object-fit: contain; background: #000;">
              <source src="${safeVideoUrl}" type="video/mp4">
              Your browser does not support video playback.
            </video>
            <div class="media-footer">
              <span class="media-info">${ad.videoDuration ? '⏱ ' + escapeHtml(ad.videoDuration) : '🎬 Video'}</span>
              <a href="${safeVideoUrl}" download target="_blank" class="btn-download">⬇ Download Video</a>
            </div>
          </div>
        `;
      } else {
        // Video URL not available (blob URL or protected)
        mediaHtml += `
          <div class="media-item">
            <div style="position: relative;">
              <img src="${safePosterUrl}" alt="Video thumbnail" style="max-height: 400px; width: 100%; object-fit: contain;">
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 12px 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; margin-bottom: 8px;">▶️</div>
                <div style="font-size: 12px;">Video Preview</div>
                <div style="font-size: 10px; margin-top: 4px; opacity: 0.8;">Klik "Lihat Detail Iklan" di Ads Library untuk play video</div>
              </div>
            </div>
            <div class="media-footer">
              <span class="media-info">🎬 Video (thumbnail only)</span>
              <a href="${safePosterUrl}" download target="_blank" class="btn-download">⬇ Download Thumbnail</a>
            </div>
          </div>
        `;
      }
    }
    
    // Images
    if (ad.mediaUrls && ad.mediaUrls.length > 0) {
      const imagesToShow = ad.mediaType === 'video' 
        ? ad.mediaUrls.slice(1)  // Skip first image (already shown as poster)
        : ad.mediaUrls;
        
      imagesToShow.forEach((url, i) => {
        const safeUrl = escapeHtml(url);
        mediaHtml += `
          <div class="media-item">
            <img src="${safeUrl}" alt="Ad creative ${i + 1}" loading="lazy" style="max-height: 400px; width: 100%; object-fit: contain;" onerror="this.parentElement.style.display='none'">
            <div class="media-footer">
              <span class="media-info">📷 Gambar ${i + 1}</span>
              <a href="${safeUrl}" download target="_blank" class="btn-download">⬇ Download</a>
            </div>
          </div>
        `;
      });
    }

    const adPreview = ad.adText ? ad.adText.substring(0, 80) : 'Klik untuk lihat detail';

    const detailsHtml = `
      <div class="ad-details" id="ad-details-${idx}">
        
        ${ad.adHeadline ? `
          <div class="ad-content-section">
            <div class="content-label">Headline</div>
            <div class="ad-headline">${escapeHtml(ad.adHeadline)}</div>
          </div>
        ` : ''}
        
        ${mediaHtml ? `
          <div class="ad-content-section">
            <div class="content-label">Media Konten</div>
            <div class="media-grid">${mediaHtml}</div>
          </div>
        ` : ''}
        
        <!-- TEKS IKLAN - ALWAYS SHOW (Fitur Utama!) -->
        <div class="ad-content-section" style="background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); padding: 16px; border-radius: 12px; border-left: 4px solid #4F46E5;">
          <div class="content-label" style="color: #4F46E5; display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
            <span style="font-size: 16px;">💬</span>
            <span>TEKS IKLAN</span>
          </div>
          ${ad.adText && ad.adText.trim() ? `
            <div class="ad-text" style="font-size: 15px; line-height: 1.8; color: #1F2937; white-space: pre-wrap; background: white; padding: 14px; border-radius: 8px; border: 1px solid #E0E7FF;">
              ${escapeHtml(ad.adText)}
            </div>
          ` : `
            <div style="padding: 14px; background: white; border-radius: 8px; text-align: center; color: #9CA3AF; font-style: italic; border: 1px dashed #D1D5DB;">
              Teks iklan tidak terdeteksi atau tidak tersedia
            </div>
          `}
        </div>
        
        <div class="ad-content-section">
          <div class="content-label">Informasi</div>
          <div class="meta-tags">
            ${ad.adId ? `<span class="meta-tag">ID: ${escapeHtml(String(ad.adId).substring(0, 16))}</span>` : ''}
            ${ad.startDate ? `<span class="meta-tag">📅 ${escapeHtml(ad.startDate)}</span>` : ''}
            ${ad.platforms ? `<span class="meta-tag">📱 ${escapeHtml(ad.platforms)}</span>` : ''}
            ${ad.mediaType ? `<span class="meta-tag">🎬 ${escapeHtml(ad.mediaType)}</span>` : ''}
            ${ad.rating ? `<span class="meta-tag">⭐ ${escapeHtml(ad.rating)}</span>` : ''}
          </div>
        </div>
        
        ${ad.landingPageUrl || ad.advertiserUrl ? `
          <div class="ad-content-section">
            <div class="content-label">Links</div>
            <div class="links-section">
              ${ad.landingPageUrl ? `
                <a href="${escapeHtml(ad.landingPageUrl)}" target="_blank" rel="noopener" class="link-item">
                  <span class="link-icon">🎯</span>
                  <div class="link-content">
                    <div class="link-title">${escapeHtml(ad.ctaText || 'Landing Page')}</div>
                    <div class="link-url">${escapeHtml(ad.landingDomain || ad.landingPageUrl.substring(0, 50))}</div>
                  </div>
                  <span style="font-size: 18px;">→</span>
                </a>
              ` : ''}
              ${ad.advertiserUrl ? `
                <a href="${escapeHtml(ad.advertiserUrl)}" target="_blank" rel="noopener" class="link-item">
                  <span class="link-icon">👤</span>
                  <div class="link-content">
                    <div class="link-title">Halaman Advertiser</div>
                    <div class="link-url">${escapeHtml(ad.advertiserName)}</div>
                  </div>
                  <span style="font-size: 18px;">→</span>
                </a>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        ${ad.advertiserAvatarUrl ? `
          <div class="advertiser-info">
            <img src="${escapeHtml(ad.advertiserAvatarUrl)}" class="advertiser-avatar-sm" onerror="this.style.display='none'" alt="Avatar">
            <div class="advertiser-details">
              <h4>${escapeHtml(ad.advertiserName)}</h4>
              ${ad.advertiserStatus ? `<p>${escapeHtml(ad.advertiserStatus)}</p>` : ''}
            </div>
          </div>
        ` : ''}
        
      </div>
    `;

    return `
      <div class="ad-card">
        <div class="ad-header" data-target-id="ad-details-${idx}">
          <div class="ad-rank">${idx + 1}</div>
          <div class="ad-avatar">${initial}</div>
          <div class="ad-info">
            <div class="ad-name">${escapeHtml(ad.advertiserName)}</div>
            <div class="ad-preview">${escapeHtml(adPreview)}${ad.adText && ad.adText.length > 80 ? '...' : ''}</div>
          </div>
          <div class="ad-meta">
            <span class="duplicate-badge ${badgeClass}">${ad.duplicateCount}× duplikat</span>
            <span class="expand-icon">▼</span>
          </div>
        </div>
        ${detailsHtml}
      </div>
    `;
  }).join('');
  
  console.log(`[Dashboard] Rendered ${filteredAdvertisers.length} cards`);
}

// ---- Toggle expand/collapse ----
window.toggleCard = function(headerEl, listId) {
  console.log('[Dashboard] Toggle card:', listId);
  const details = document.getElementById(listId);
  const icon = headerEl.querySelector('.expand-icon');
  
  if (!details) {
    console.error('[Dashboard] Cannot find element:', listId);
    return;
  }
  
  const isExpanded = details.classList.contains('visible');
  console.log('[Dashboard] Currently expanded:', isExpanded);

  details.classList.toggle('visible', !isExpanded);
  icon.classList.toggle('expanded', !isExpanded);
  headerEl.classList.toggle('expanded', !isExpanded);
  
  console.log('[Dashboard] Toggled to:', !isExpanded);
};

// ---- Export ----
window.exportCSV = function() {
  console.log('[Dashboard] Export CSV clicked, ads:', filteredAdvertisers.length);
  
  if (!filteredAdvertisers.length) {
    showToast('Tidak ada data untuk di-export');
    return;
  }

  try {
    const rows = [[
      'Ad ID',
      'Duplicate Count',
      'Advertiser Name',
      'Advertiser URL',
      'Advertiser Avatar',
      'Status',
      'Start Date',
      'Ad Headline',
      'Ad Text',
      'Platforms',
      'Media Type',
      'Video Source URL',
      'Image URL 1',
      'Image URL 2',
      'Image URL 3',
      'Video Duration',
      'Landing Page URL',
      'Landing Domain',
      'CTA Text',
      'Rating',
      'Scraped At'
    ]];
    
    filteredAdvertisers.forEach((ad) => {
      rows.push([
        ad.adId || '',
        ad.duplicateCount || '',
        ad.advertiserName || '',
        ad.advertiserUrl || '',
        ad.advertiserAvatarUrl || '',
        ad.advertiserStatus || '',
        ad.startDate || '',
        (ad.adHeadline || '').replace(/,/g, ';').replace(/\n/g, ' ').substring(0, 300),
        (ad.adText || '').replace(/,/g, ';').replace(/\n/g, ' ').substring(0, 500),
        ad.platforms || '',
        ad.mediaType || '',
        ad.videoSourceUrl || '', // VIDEO SOURCE URL - untuk download!
        (ad.mediaUrls && ad.mediaUrls[0]) || '',
        (ad.mediaUrls && ad.mediaUrls[1]) || '',
        (ad.mediaUrls && ad.mediaUrls[2]) || '',
        ad.videoDuration || '',
        ad.landingPageUrl || '',
        ad.landingDomain || '',
        ad.ctaText || '',
        ad.rating || '',
        ad.scrapedAt || ''
      ]);
    });

    const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const filename = `ads-duplicate-LENGKAP-${Date.now()}.csv`;
    
    console.log('[Dashboard] CSV prepared, size:', csvContent.length, 'bytes');
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
    showToast('✓ CSV berhasil di-export!');
  } catch (error) {
    console.error('[Dashboard] Export CSV error:', error);
    showToast('❌ Error saat export CSV');
  }
};

window.exportJSON = function() {
  console.log('[Dashboard] Export JSON clicked');
  
  if (!filteredAdvertisers.length) {
    showToast('Tidak ada data untuk di-export');
    return;
  }

  try {
    const data = {
      exportedAt: new Date().toISOString(),
      totalAds: rawAds.length,
      duplicateAds: filteredAdvertisers
    };

    const json = JSON.stringify(data, null, 2);
    const filename = `ads-duplicate-content-${Date.now()}.json`;
    
    console.log('[Dashboard] JSON prepared, size:', json.length, 'bytes');
    downloadFile(json, filename, 'application/json');
    showToast('✓ JSON berhasil di-export!');
  } catch (error) {
    console.error('[Dashboard] Export JSON error:', error);
    showToast('❌ Error saat export JSON');
  }
};

function downloadFile(content, filename, mimeType) {
  console.log('[Dashboard] Download file:', filename);
  
  try {
    // Method 1: Blob + createObjectURL
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('[Dashboard] Download triggered successfully');
    }, 100);
  } catch (error) {
    console.error('[Dashboard] Download error:', error);
    
    // Fallback: data URI
    try {
      const dataUri = 'data:' + mimeType + ',' + encodeURIComponent(content);
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = filename;
      a.click();
      console.log('[Dashboard] Fallback download triggered');
    } catch (e2) {
      console.error('[Dashboard] Fallback download also failed:', e2);
      alert('Error: Tidak dapat mendownload file. Coba lagi atau gunakan browser lain.');
    }
  }
}

// ---- Refresh ----
window.refreshData = async function() {
  console.log('[Dashboard] Refresh data');
  rawAds = [];
  advertisers = [];
  filteredAdvertisers = [];
  await init();
  showToast('Data diperbarui!');
};

// ---- Toast ----
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ---- Utility ----
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- Setup Event Listeners ----
function setupEventListeners() {
  console.log('[Dashboard] Setting up event listeners...');
  
  // Header buttons
  const btnRefresh = document.getElementById('btn-refresh');
  const btnExportCSV = document.getElementById('btn-export-csv');
  
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      console.log('[Dashboard] Refresh button clicked');
      window.refreshData();
    });
  }
  
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      console.log('[Dashboard] Export CSV (header) clicked');
      window.exportCSV();
    });
  }
  
  // Toolbar filters
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const filterMin = document.getElementById('filter-min');
  
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      console.log('[Dashboard] Search input changed');
      applyFilters();
    });
  }
  
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      console.log('[Dashboard] Sort changed');
      applyFilters();
    });
  }
  
  if (filterMin) {
    filterMin.addEventListener('change', () => {
      console.log('[Dashboard] Filter min changed');
      applyFilters();
    });
  }
  
  // Export buttons (bottom)
  const btnExportJSON = document.getElementById('btn-export-json');
  const btnExportCSVBottom = document.getElementById('btn-export-csv-bottom');
  
  if (btnExportJSON) {
    btnExportJSON.addEventListener('click', () => {
      console.log('[Dashboard] Export JSON clicked');
      window.exportJSON();
    });
  }
  
  if (btnExportCSVBottom) {
    btnExportCSVBottom.addEventListener('click', () => {
      console.log('[Dashboard] Export CSV (bottom) clicked');
      window.exportCSV();
    });
  }
  
  // Event delegation for card headers (expand/collapse)
  const grid = document.getElementById('ads-grid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      // Find the ad-header element
      const header = e.target.closest('.ad-header');
      if (header) {
        const targetId = header.getAttribute('data-target-id');
        if (targetId) {
          console.log('[Dashboard] Card header clicked:', targetId);
          window.toggleCard(header, targetId);
        }
      }
    });
  }
  
  console.log('[Dashboard] Event listeners setup complete');
}

// ---- Start ----
init().then(() => {
  setupEventListeners();
});
