/*
 * Minimal Bastyon mini-app messaging helper for iframe postMessage.
 * - Strict origin checks via VITE_BASTYON_ORIGINS (comma-separated).
 * - Promise-based request/response with correlation id.
 * - Safe no-ops when not embedded.
 */

function parseAllowedOrigins() {
  let list = [];
  try {
    if (import.meta && import.meta.env && import.meta.env.VITE_BASTYON_ORIGINS) {
      list = String(import.meta.env.VITE_BASTYON_ORIGINS)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }
  } catch (_) { /* no-op */ }
  return list;
}

export function createMiniAppMessenger(options = {}) {
  const allowedOrigins = Array.isArray(options.allowedOrigins) && options.allowedOrigins.length
    ? options.allowedOrigins
    : parseAllowedOrigins();

  const isEmbedded = typeof window !== 'undefined' && window.top !== window.self;

  const pending = new Map(); // id -> { resolve, reject }
  const listeners = new Set(); // custom subscribers

  let disposed = false;

  function isOriginAllowed(origin) {
    if (!allowedOrigins.length) return false;
    return allowedOrigins.includes(origin);
  }

  function onMessage(event) {
    if (disposed) return;
    try {
      const { origin, data, source } = event;
      if (!isOriginAllowed(origin)) return;
      if (source !== window.parent) return;
      if (!data || typeof data !== 'object') return;

      const { __miniapp__, id, type, payload, error } = data;
      if (__miniapp__ !== true) return;

      // Resolve pending request
      if (id && pending.has(id)) {
        const { resolve, reject } = pending.get(id);
        pending.delete(id);
        if (error) reject(error);
        else resolve({ type, payload, origin });
        return;
      }

      // Fan-out to subscribers for unsolicited messages
      listeners.forEach(fn => {
        try { fn({ type, payload, origin }); } catch (_) { /* ignore */ }
      });
    } catch (_) { /* no-op */ }
  }

  function addGlobalListener() {
    try { window.addEventListener('message', onMessage, false); } catch (_) { /* no-op */ }
  }
  function removeGlobalListener() {
    try { window.removeEventListener('message', onMessage, false); } catch (_) { /* no-op */ }
  }

  function genId() {
    return 'mm_' + Math.random().toString(36).slice(2) + '_' + Date.now();
  }

  function request(type, payload) {
    if (!isEmbedded) {
      return Promise.reject(new Error('Not embedded in Bastyon host'));
    }
    const id = genId();
    const message = { __miniapp__: true, id, type, payload };

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        window.parent.postMessage(message, '*');
      } catch (err) {
        pending.delete(id);
        reject(err);
      }
      // Optional: timeout to avoid hanging forever
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error('MiniApp request timeout: ' + type));
        }
      }, 15000);
    });
  }

  function on(fn) { if (typeof fn === 'function') listeners.add(fn); return () => listeners.delete(fn); }
  function off(fn) { listeners.delete(fn); }

  function dispose() {
    disposed = true;
    removeGlobalListener();
    listeners.clear();
    pending.forEach(({ reject }, key) => { try { reject(new Error('Disposed')); } catch (_) {} pending.delete(key); });
  }

  // Auto-attach listener in embedded mode
  if (isEmbedded) addGlobalListener();

  return { isEmbedded, request, on, off, dispose };
}

export default { createMiniAppMessenger };
