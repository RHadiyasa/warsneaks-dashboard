const runningRequests = new Set();

window.addEventListener('message', event => {
  if (event.source !== window || event.data?.source !== 'warsneaks-meta-scanner') return;
  if (['WARSNEAKS_META_SCAN_PROGRESS', 'WARSNEAKS_META_SCANNER_CONTROLLED'].includes(event.data.type)) {
    runningRequests.add(event.data.requestId);
  }
  chrome.runtime.sendMessage({ type: 'WARSNEAKS_META_SCAN_EVENT', event: event.data }).catch(() => {});
});

async function bootstrapDashboardScan() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const scan = await chrome.runtime.sendMessage({ type: 'WARSNEAKS_GET_TAB_SCAN' }).catch(() => null);
    if (scan?.requestId) {
      for (let controlAttempt = 0; controlAttempt < 20 && !runningRequests.has(scan.requestId); controlAttempt++) {
        window.postMessage({ source: 'warsneaks-extension-control', type: 'WARSNEAKS_START_SCANNER', requestId: scan.requestId, targetCount: scan.targetCount }, window.location.origin);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

bootstrapDashboardScan().catch(() => {});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!['WARSNEAKS_SCANNER_PING', 'WARSNEAKS_START_SCANNER', 'WARSNEAKS_STOP_SCANNER'].includes(message?.type)) return;
  if (message.type === 'WARSNEAKS_STOP_SCANNER') {
    window.postMessage({ source: 'warsneaks-extension-control', ...message }, window.location.origin);
    sendResponse({ success: true });
    return;
  }
  const requestId = message.requestId || `ping-${Date.now()}`;
  let settled = false;
  const expectedType = message.type === 'WARSNEAKS_SCANNER_PING' ? 'WARSNEAKS_META_SCANNER_READY' : 'WARSNEAKS_META_SCANNER_CONTROLLED';
  const handler = event => {
    if (event.source !== window || event.data?.source !== 'warsneaks-meta-scanner' || event.data.type !== expectedType || event.data.requestId !== requestId) return;
    settled = true;
    window.removeEventListener('message', handler);
    sendResponse({ success: true });
  };
  window.addEventListener('message', handler);
  window.postMessage({ source: 'warsneaks-extension-control', ...message, requestId }, window.location.origin);
  setTimeout(() => {
    if (settled) return;
    window.removeEventListener('message', handler);
    sendResponse({ success: false });
  }, 250);
  return true;
});
