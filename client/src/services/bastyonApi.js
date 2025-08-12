/**
 * Bastyon API service for interacting with the server-side PocketNetProxyApi
 */

// Prefer an explicit backend API URL when embedded; fallback to relative '/api' for standalone
let API_BASE_URL = '/api';
try {
  if (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
  }
} catch (_) { /* no-op */ }

// Default CORS-friendly fetch options used across the client when embedded
const DEFAULT_FETCH_OPTIONS = {
  mode: 'cors',
  credentials: 'omit',
  cache: 'no-store',
  redirect: 'follow',
  // Conservative referrer policy to reduce cross-origin leakage
  referrerPolicy: 'strict-origin-when-cross-origin',
  headers: {
    'Accept': 'application/json'
  }
};

function mergeFetchOptions(extra) {
  const base = DEFAULT_FETCH_OPTIONS;
  const result = { ...base, ...(extra || {}) };
  if (base.headers || extra?.headers) {
    result.headers = { ...(base.headers || {}), ...(extra?.headers || {}) };
  }
  return result;
}

// Resolve API base dynamically at runtime when embedded or when provided via URL/global.
let apiBaseInitPromise = null;
function readQueryParamApiBase() {
  try {
    if (typeof window === 'undefined') return '';
    const sp = new URLSearchParams(window.location.search || '');
    // support multiple aliases
    const keys = ['apiBase', 'api_base', 'apibase', 'backend', 'baseUrl', 'baseurl'];
    for (const k of keys) {
      const v = sp.get(k);
      if (v && typeof v === 'string') return decodeURIComponent(v.trim());
    }
  } catch (_) {}
  return '';
}
function readGlobalApiBase() {
  try {
    if (typeof window !== 'undefined' && window.__BastyonShortsApiBase) {
      const v = String(window.__BastyonShortsApiBase);
      if (v) return v;
    }
  } catch (_) {}
  return '';
}
function normalizeApiBase(v) {
  try {
    if (!v) return '';
    let s = String(v).trim();
    // strip trailing slashes
    while (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch (_) { return ''; }
}
async function ensureApiBaseInitialized() {
  // If already explicit (env or previously resolved), skip
  if (API_BASE_URL && API_BASE_URL !== '/api') return;
  if (apiBaseInitPromise) return apiBaseInitPromise;
  apiBaseInitPromise = (async () => {
    // 1) URL query param override
    const fromQuery = normalizeApiBase(readQueryParamApiBase());
    if (fromQuery) {
      API_BASE_URL = fromQuery;
      try { localStorage.setItem('bastyonApiBase', API_BASE_URL); } catch (_) {}
      return;
    }
    // 2) Global window override
    const fromGlobal = normalizeApiBase(readGlobalApiBase());
    if (fromGlobal) {
      API_BASE_URL = fromGlobal;
      try { localStorage.setItem('bastyonApiBase', API_BASE_URL); } catch (_) {}
      return;
    }
    // 3) Persisted value from previous runs
    try {
      const stored = normalizeApiBase(localStorage.getItem('bastyonApiBase'));
      if (stored) { API_BASE_URL = stored; return; }
    } catch (_) {}
    // 4) If embedded, try asking the host via mini-app messaging (best-effort)
    try {
      if (typeof window !== 'undefined' && window.top !== window.self) {
        const mod = await import('./miniAppMessaging.js');
        const messenger = mod && typeof mod.createMiniAppMessenger === 'function'
          ? mod.createMiniAppMessenger()
          : (mod && mod.default && typeof mod.default.createMiniAppMessenger === 'function'
            ? mod.default.createMiniAppMessenger()
            : null);
        if (messenger && messenger.isEmbedded) {
          try {
            const res = await messenger.request('bastyon:getApiBase', {});
            const candidate = normalizeApiBase(res && (res.payload?.apiBase || res.payload?.baseUrl || res.payload));
            if (candidate) {
              API_BASE_URL = candidate;
              try { localStorage.setItem('bastyonApiBase', API_BASE_URL); } catch (_) {}
              return;
            }
          } catch (_) { /* ignore */ }
        }
      }
    } catch (_) { /* ignore */ }
    // 5) Fallback remains '/api'
  })();
  return apiBaseInitPromise;
}

// Warn if running embedded but API base is not configured (likely to hit host origin instead of your backend)
try {
  if (typeof window !== 'undefined' && window.top !== window.self) {
    let hasExplicitApi = false;
    try {
      hasExplicitApi = !!(import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL);
    } catch (_) { /* no-op */ }
    if (!hasExplicitApi && typeof console !== 'undefined' && console.warn) {
      console.warn('[bastyonApi] Embedded mode detected but VITE_API_BASE_URL is not set; using relative /api which may not reach your backend.');
    }
  }
} catch (_) { /* no-op */ }

// Fetch playlist JSON generated on the server and served statically
export async function fetchPlaylist(lang = 'en') {
  try {
    const response = await fetch(`/playlists/${encodeURIComponent(lang)}/latest.json`, mergeFetchOptions({
      // keep cache disabled for freshness
      cache: 'no-store'
    }));
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : (data?.items || []);
  } catch (error) {
    console.error('Error fetching playlist JSON:', error);
    throw error;
  }
}

// Fetch all videos with duration < 2 minutes
export async function fetchBShorts(lang = 'en', { limit, offset } = {}) {
  try {
    await ensureApiBaseInitialized();
    const params = new URLSearchParams();
    if (lang) params.set('lang', lang);
    if (limit != null) params.set('limit', String(limit));
    if (offset != null) params.set('offset', String(offset));
    const qs = params.toString();
    const url = `${API_BASE_URL}/videos/bshorts${qs ? `?${qs}` : ''}`;
    const response = await fetch(url, mergeFetchOptions());
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    // Server returns an array of videos directly
    return Array.isArray(data) ? data : (data.data || []);
  } catch (error) {
    console.error('Error fetching short videos:', error);
    throw error;
  }
}

// Fetch a single user profile by address
export async function fetchProfile(address) {
  if (!address) throw new Error('address is required');
  await ensureApiBaseInitialized();
  const url = `${API_BASE_URL}/videos/profile?address=${encodeURIComponent(address)}`;
  const res = await fetch(url, mergeFetchOptions());
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
  return await res.json(); // { address, name, reputation, avatar, raw }
}

// Fetch multiple user profiles by addresses (best-effort)
export async function fetchProfiles(addresses) {
  const list = Array.isArray(addresses) ? addresses.filter(Boolean) : [];
  if (!list.length) throw new Error('addresses must be a non-empty array');
  await ensureApiBaseInitialized();
  const url = `${API_BASE_URL}/videos/profile?addresses=${encodeURIComponent(list.join(','))}`;
  const res = await fetch(url, mergeFetchOptions());
  if (!res.ok) throw new Error(`Profiles fetch failed: ${res.status}`);
  return await res.json(); // { count, profiles: [ ... ] }
}

// Fetch comments for a video hash/txid. If parentid is provided, fetch replies for that comment.
export async function fetchComments(hash, { limit = 50, offset = 0, includeProfiles = true, includeReplies = false, repliesLimit = 10, parentid } = {}) {
  if (!hash) throw new Error('hash is required');
  await ensureApiBaseInitialized();
  const params = new URLSearchParams();
  params.set('hash', hash);
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  if (includeProfiles) params.set('includeProfiles', '1');
  if (includeReplies) params.set('includeReplies', '1');
  if (repliesLimit != null) params.set('repliesLimit', String(repliesLimit));
  if (parentid != null) params.set('parentid', String(parentid));
  const url = `${API_BASE_URL}/videos/comments?${params.toString()}`;
  const res = await fetch(url, mergeFetchOptions());
  if (!res.ok) throw new Error(`Comments fetch failed: ${res.status}`);
  return await res.json();
}

// Post a comment on a video
export async function postComment(videoId, commentText, userAddress) {
  try {
    await ensureApiBaseInitialized();
    const response = await fetch(`${API_BASE_URL}/videos/comment`, mergeFetchOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ videoId, commentText, userAddress })
    }));
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error posting comment:', error);
    throw error;
  }
}

// Donate PKoin to a creator
export async function donatePKoin(creatorAddress, amount, userAddress) {
  try {
    await ensureApiBaseInitialized();
    const response = await fetch(`${API_BASE_URL}/donate`, mergeFetchOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ creatorAddress, amount, userAddress })
    }));
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error processing donation:', error);
    throw error;
  }
}

// Rate a video
export async function rateVideo(videoId, rating, userAddress) {
  try {
    await ensureApiBaseInitialized();
    const response = await fetch(`${API_BASE_URL}/videos/rate`, mergeFetchOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ videoId, rating, userAddress })
    }));
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error rating video:', error);
    throw error;
  }
}

// Upload a video
export async function uploadVideo(videoData) {
  try {
    await ensureApiBaseInitialized();
    const response = await fetch(`${API_BASE_URL}/videos/upload`, mergeFetchOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(videoData)
    }));
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
}

const bastyonApi = {
  fetchPlaylist,
  fetchBShorts,
  fetchProfile,
  fetchProfiles,
  fetchComments,
  postComment,
  donatePKoin,
  rateVideo,
  uploadVideo
};

export default bastyonApi;
