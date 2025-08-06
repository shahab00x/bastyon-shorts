const axios = require('axios');

async function verifyFixes() {
  try {
    console.log('Testing Bastyon Shorts API endpoint...');
    const response = await axios.get('http://localhost:3030/api/videos/bshorts');
    
    console.log('Response status:', response.status);
    console.log('Number of videos returned:', response.data.length);
    
    if (response.data.length > 0) {
      console.log('\nFirst video details:');
      const firstVideo = response.data[0];
      console.log('- ID:', firstVideo.id);
      console.log('- URL:', firstVideo.url);
      console.log('- Duration:', firstVideo.duration);
      console.log('- Has valid URL:', firstVideo.url && firstVideo.url.length > 0);
      
      // Check if we have any videos with actual durations
      const videosWithDurations = response.data.filter(video => video.duration > 0);
      console.log(`\nVideos with valid durations: ${videosWithDurations.length}/${response.data.length}`);
      
      // Check if we have any PeerTube videos that were converted
      const peerTubeVideos = response.data.filter(video => video.url && video.url.includes('peertube'));
      console.log(`PeerTube videos (should be 0 after conversion): ${peerTubeVideos.length}`);
      
      // Check if we have properly converted videos
      const convertedVideos = response.data.filter(video => 
        video.url && (video.url.includes('download/streaming-playlists') || video.url.includes('.mp4')));
      console.log(`Converted videos: ${convertedVideos.length}`);
    } else {
      console.log('No videos returned');
    }
  } catch (error) {
    console.error('Error testing endpoint:', error.message);
  }
}

verifyFixes();
