/**
 * Video source utility to replace sample videos with actual PeerTube videos
 * from the cached playlist JSON files
 */

// Import the English cached playlist
import playlistData from '../../public/playlists/en/latest.json';

// Convert PeerTube URLs to direct video URLs
function convertPeerTubeUrl(peertubeUrl) {
  // Handle peertube:// URLs
  if (peertubeUrl.startsWith('peertube://')) {
    const url = peertubeUrl.replace('peertube://', 'https://');
    return url;
  }
  
  // Handle direct URLs
  return peertubeUrl;
}

// Get actual video sources from cached playlist
export function getActualVideoSources(limit = 5) {
  const videos = playlistData.slice(0, limit);
  
  return videos.map(video => ({
    id: video.id,
    title: video.description,
    url: convertPeerTubeUrl(video.url),
    thumbnail: video.uploaderAvatar || 'https://via.placeholder.com/320x180',
    duration: video.duration,
    uploader: video.uploader,
    uploaderAddress: video.uploaderAddress,
    timestamp: video.timestamp,
    likes: video.likes,
    comments: video.comments
  }));
}

// Replace any sample video references with actual videos
export function replaceSampleVideos() {
  console.log('Replacing sample videos with actual PeerTube videos from cached playlists');
  
  const actualVideos = getActualVideoSources(10);
  
  // Log the first few videos for debugging
  console.log('Available videos:', actualVideos.slice(0, 3));
  
  return actualVideos;
}

// Video source configuration
export const videoSources = {
  // Use actual PeerTube videos instead of sample URLs
  videos: getActualVideoSources(),
  
  // Sample video replacements
  replacements: {
    'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4': null, // Remove sample
    'https://sample-videos.com/video123/mp4/480/big_buck_bunny_480p_1mb.mp4': null, // Remove sample
  }
};

export default videoSources;
