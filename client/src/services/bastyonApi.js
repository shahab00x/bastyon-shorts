/**
 * Bastyon API service for interacting with the server-side PocketNetProxyApi
 */

const API_BASE_URL = '/api';

// Fetch videos with hashtag #bshorts and duration < 2 minutes
export async function fetchBShorts() {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/bshorts`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching BShorts:', error);
    throw error;
  }
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
  fetchBShorts,
  postComment,
  donatePKoin,
  rateVideo,
  uploadVideo
};

export default bastyonApi;
