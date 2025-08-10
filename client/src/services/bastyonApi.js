/**
 * Bastyon API service for interacting with the server-side PocketNetProxyApi
 */

const API_BASE_URL = '/api';

// Fetch playlist JSON generated on the server and served statically
export async function fetchPlaylist(lang = 'en') {
  try {
    const response = await fetch(`/playlists/${encodeURIComponent(lang)}/latest.json`, {
      cache: 'no-store'
    });
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
export async function fetchBShorts() {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/bshorts`);
    
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
  const url = `${API_BASE_URL}/videos/profile?address=${encodeURIComponent(address)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
  return await res.json(); // { address, name, reputation, avatar, raw }
}

// Fetch multiple user profiles by addresses (best-effort)
export async function fetchProfiles(addresses) {
  const list = Array.isArray(addresses) ? addresses.filter(Boolean) : [];
  if (!list.length) throw new Error('addresses must be a non-empty array');
  const url = `${API_BASE_URL}/videos/profile?addresses=${encodeURIComponent(list.join(','))}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Profiles fetch failed: ${res.status}`);
  return await res.json(); // { count, profiles: [ ... ] }
}

// Fetch comments for a video hash/txid
export async function fetchComments(hash, { limit = 50, offset = 0, includeProfiles = true, includeReplies = false, repliesLimit = 10 } = {}) {
  if (!hash) throw new Error('hash is required');
  const params = new URLSearchParams();
  params.set('hash', hash);
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  if (includeProfiles) params.set('includeProfiles', '1');
  if (includeReplies) params.set('includeReplies', '1');
  if (repliesLimit != null) params.set('repliesLimit', String(repliesLimit));
  const url = `${API_BASE_URL}/videos/comments?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Comments fetch failed: ${res.status}`);
  return await res.json();
}

// Post a comment on a video
export async function postComment(videoId, commentText, userAddress) {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId, commentText, userAddress })
    });
    
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
    const response = await fetch(`${API_BASE_URL}/donate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ creatorAddress, amount, userAddress })
    });
    
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
    const response = await fetch(`${API_BASE_URL}/videos/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId, rating, userAddress })
    });
    
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
    const response = await fetch(`${API_BASE_URL}/videos/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(videoData)
    });
    
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
