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

// Quiet logger: suppresses warnings in console for expected network failures
const QUIET_LOGS = true;
function safeWarn(...args) {
  try {
    if (!QUIET_LOGS && typeof console !== 'undefined' && console.warn) console.warn(...args);
  } catch (_) { /* no-op */ }
}

// Runtime check to disable API calls entirely
// Checks environment variables, URL params, localStorage, and global flags
function isApiDisabled() {
  // Manual override - force disable API calls
  // Set this to true to disable all API calls regardless of other settings
  const FORCE_DISABLE_API = true;
  
  if (FORCE_DISABLE_API) {
    console.log('API calls disabled via manual override');
    return true;
  }
  
  try {
    // Check environment variables at runtime
    let envValue = '';
    
    // Try import.meta.env (Vite)
    try {
      if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
        envValue = (import.meta.env.VITE_DISABLE_API ?? import.meta.env.vite_disable_api ?? '').toString();
      }
    } catch (_) {}
    
    // Try process.env (Node.js)
    try {
      if (typeof process !== 'undefined' && process.env) {
        envValue = envValue || (process.env.VITE_DISABLE_API ?? process.env.vite_disable_api ?? '').toString();
      }
    } catch (_) {}
    
    if (envValue.toLowerCase() === 'true' || envValue === '1' || envValue === 'yes') {
      console.log('API calls disabled via environment variable:', envValue);
      return true;
    }
    
    // Check URL parameters
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search || '');
      const qp = (sp.get('disableApi') || sp.get('disable_api') || '').toLowerCase();
      if (qp === '1' || qp === 'true' || qp === 'yes') {
        console.log('API calls disabled via URL parameter');
        return true;
      }
      
      // Check localStorage
      try {
        const ls = (localStorage.getItem('bshorts:disableApi') || '').toLowerCase();
        if (ls === '1' || ls === 'true' || ls === 'yes') {
          console.log('API calls disabled via localStorage');
          return true;
        }
      } catch (_) {}
      
      // Check global variables
      if (window.__BShortsDisableApi === true) {
        console.log('API calls disabled via global variable');
        return true;
      }
      
      if (window.__VITE_DISABLE_API === true) {
        console.log('API calls disabled via VITE global');
        return true;
      }
    }
  } catch (_) { /* ignore */ }
  return false;
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
    if (!hasExplicitApi) {
      safeWarn('[bastyonApi] Embedded mode detected but VITE_API_BASE_URL is not set; using relative /api which may not reach your backend.');
    }
  }
} catch (_) { /* no-op */ }

// Fetch playlist JSON from cached files to avoid CORS and 502 issues
export async function fetchPlaylist(lang = 'en') {
  if (isApiDisabled()) {
    console.log('API disabled, using cached playlist for', lang);
  }
  
  // Always use cached JSON files to avoid CORS and 502 errors
  try {
    const playlistPath = `/playlists/${lang}/latest.json`;
    const response = await fetch(playlistPath);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // Convert PeerTube URLs to direct URLs
    return data.map(video => ({
      ...video,
      url: video.url.startsWith('peertube://') 
        ? video.url.replace('peertube://', 'https://')
        : video.url,
      playlistUrl: video.url.startsWith('peertube://') 
        ? video.url.replace('peertube://', 'https://').replace('/videos/', '/download/streaming-playlists/hls/videos/') + '-360-fragmented.mp4'
        : video.url
    }));
    
  } catch (error) {
    console.warn('Failed to load cached playlist:', error);
    // Fallback to English if specific language fails
    if (lang !== 'en') {
      try {
        const fallbackResponse = await fetch('/playlists/en/latest.json');
        if (!fallbackResponse.ok) throw new Error(`HTTP ${fallbackResponse.status}`);
        const data = await fallbackResponse.json();
        return data.map(video => ({
          ...video,
          url: video.url.startsWith('peertube://') 
            ? video.url.replace('peertube://', 'https://')
            : video.url
        }));
      } catch (fallbackError) {
        console.error('Failed to load fallback playlist:', fallbackError);
        return [];
      }
    }
    return [];
  }
}

// Fetch all videos with duration < 2 minutes
export async function fetchBShorts(lang = 'en', { limit, offset } = {}) {
  if (isApiDisabled()) return [];
  
  // First, try to fetch from the API server
  try {
    await ensureApiBaseInitialized();
    const params = new URLSearchParams();
    if (lang) params.set('lang', lang);
    if (limit != null) params.set('limit', String(limit));
    if (offset != null) params.set('offset', String(offset));
    const qs = params.toString();
    const url = `${API_BASE_URL}/videos/bshorts${qs ? `?${qs}` : ''}`;
    
    // Add timeout to detect server unavailability quickly
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(url, mergeFetchOptions({ signal: controller.signal }));
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : (data.data || []);
    }
    
    // If server responds with 502 or 500, it's likely the playlist server isn't running
    if (response.status >= 500) {
      safeWarn('[bastyonApi] Playlist server appears to be down, falling back to cached JSON');
    }
  } catch (error) {
    // Network error, timeout, or server unreachable - fall back to cached JSON
    safeWarn('[bastyonApi] API server unavailable, falling back to cached playlists:', error.message);
  }
  
  // Fallback to cached JSON files in playlists folder
  try {
    // Try to load from cached playlists folder
    const cachedUrl = `/playlists/${encodeURIComponent(lang)}/latest.json`;
    const cachedResponse = await fetch(cachedUrl, mergeFetchOptions({
      cache: 'force-cache', // Use cached version
      signal: undefined // Remove timeout for cached files
    }));
    
    if (cachedResponse.ok) {
      const data = await cachedResponse.json();
      const videos = Array.isArray(data) ? data : (data.data || []);
      
      // Apply limit/offset if provided
      if (offset != null || limit != null) {
        const start = offset || 0;
        const end = limit ? start + limit : undefined;
        return videos.slice(start, end);
      }
      
      return videos;
    }
  } catch (fallbackError) {
    safeWarn('[bastyonApi] Fallback to cached playlists also failed:', fallbackError.message);
  }
  
  // Return empty array if both API and cached files fail
  return [];
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
