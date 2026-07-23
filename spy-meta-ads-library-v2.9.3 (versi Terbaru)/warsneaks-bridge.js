const DASHBOARD_SOURCE = 'warsneaks-dashboard';
const EXTENSION_SOURCE = 'warsneaks-extension';

function postToDashboard(message) {
  window.postMessage({ source: EXTENSION_SOURCE, ...message }, window.location.origin);
}

window.addEventListener('message', async event => {
  if (event.source !== window || event.data?.source !== DASHBOARD_SOURCE) return;
  if (!['WARSNEAKS_START_META_SCAN', 'WARSNEAKS_STOP_META_SCAN', 'WARSNEAKS_EXTENSION_PING'].includes(event.data.type)) return;
  try {
    const response = await chrome.runtime.sendMessage(event.data);
    if (response?.error) postToDashboard({ type: 'WARSNEAKS_META_SCAN_ERROR', requestId: event.data.requestId, error: response.error });
    if (event.data.type === 'WARSNEAKS_EXTENSION_PING') postToDashboard({ type: 'WARSNEAKS_EXTENSION_READY' });
  } catch (error) {
    postToDashboard({ type: 'WARSNEAKS_META_SCAN_ERROR', requestId: event.data.requestId, error: error?.message || 'EXTENSION_BRIDGE_FAILED' });
  }
});

chrome.runtime.onMessage.addListener(message => {
  if (message?.source === EXTENSION_SOURCE) postToDashboard(message);
});

window.setTimeout(() => postToDashboard({ type: 'WARSNEAKS_EXTENSION_READY' }), 0);
