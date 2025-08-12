/**
 * Video loader service to replace sample videos with actual PeerTube videos
 * from cached playlists to fix CORS issues
 */

// Load the cached playlist directly
export async function loadActualVideos() {
  try {
    // Import the cached English playlist
    const cachedPlaylist = await import('../public/playlists/en/latest.json');
    
    // Convert PeerTube URLs to direct URLs
    const videos = cachedPlaylist.default.map(video => ({
      id: video.id || video.hash || Math.random().toString(36).substr(2, 9),
      hash: video.hash || video.id,
      txid: video.txid || video.id,
      url: convertPeerTubeUrl(video.url),
      originalUrl: video.url,
      uploader: video.uploader || 'Unknown',
      uploaderAddress: video.uploaderAddress || '',
      uploaderAvatar: video.uploaderAvatar || '',
      description: video.description || 'No description',
      duration: video.duration || 0,
      timestamp: video.timestamp || new Date().toISOString(),
      likes: video.likes || 0,
      comments: video.comments || 0,
      userRating: 0,
      averageRating: 0,
      ratingsCount: 0,
      commentData: []
    }));
    
    console.log('Loaded', videos.length, 'actual PeerTube videos from cached playlists');
    return videos;
    
  } catch (error) {
    console.error('Failed to load cached videos:', error);
    return [];
  }
}

// Convert peertube:// URLs to https:// URLs
function convertPeerTubeUrl(peertubeUrl) {
  if (!peertubeUrl) return '';
  
  // Handle peertube:// URLs
  if (peertubeUrl.startsWith('peertube://')) {
    return peertubeUrl.replace('peertube://', 'https://');
  }
  
  return peertubeUrl;
}

// Export the video loader
export default { loadActualVideos };
