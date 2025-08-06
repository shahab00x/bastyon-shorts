const axios = require('axios');

async function debugStructure() {
  try {
    console.log('Fetching Bastyon Shorts API data for structure analysis...');
    const response = await axios.get('http://localhost:3030/api/videos/bshorts');
    
    console.log('Response status:', response.status);
    console.log('Number of videos returned:', response.data.length);
    
    if (response.data.length > 0) {
      console.log('\nAnalyzing first 3 videos for structure:');
      
      for (let i = 0; i < Math.min(3, response.data.length); i++) {
        const video = response.data[i];
        console.log(`\n--- Video ${i + 1} ---`);
        console.log('ID:', video.id);
        console.log('URL:', video.url);
        console.log('Duration:', video.duration);
        
        // Log the videoInfo structure if it exists
        if (video.videoInfo) {
          console.log('VideoInfo keys:', Object.keys(video.videoInfo));
          
          // Check for duration in various places
          if (video.videoInfo.duration !== undefined) {
            console.log('videoInfo.duration:', video.videoInfo.duration);
          }
          
          if (video.videoInfo.v) {
            console.log('videoInfo.v keys:', Object.keys(video.videoInfo.v));
            if (video.videoInfo.v.duration !== undefined) {
              console.log('videoInfo.v.duration:', video.videoInfo.v.duration);
            }
          }
          
          if (video.videoInfo.videos) {
            console.log('videoInfo.videos type:', Array.isArray(video.videoInfo.videos) ? 'array' : typeof video.videoInfo.videos);
            if (Array.isArray(video.videoInfo.videos) && video.videoInfo.videos.length > 0) {
              console.log('First video in videos array keys:', Object.keys(video.videoInfo.videos[0]));
              if (video.videoInfo.videos[0].duration !== undefined) {
                console.log('First video duration:', video.videoInfo.videos[0].duration);
              }
            }
          }
        }
        
        // Log raw post structure if it exists
        if (video.rawPost) {
          console.log('RawPost keys:', Object.keys(video.rawPost));
          
          if (video.rawPost.s) {
            console.log('rawPost.s keys:', Object.keys(video.rawPost.s));
            
            if (video.rawPost.s.duration !== undefined) {
              console.log('rawPost.s.duration:', video.rawPost.s.duration);
            }
            
            if (video.rawPost.s.v) {
              console.log('rawPost.s.v keys:', Object.keys(video.rawPost.s.v));
              if (video.rawPost.s.v.duration !== undefined) {
                console.log('rawPost.s.v.duration:', video.rawPost.s.v.duration);
              }
            }
          }
        }
      }
    } else {
      console.log('No videos returned');
    }
  } catch (error) {
    console.error('Error debugging structure:', error.message);
  }
}

debugStructure();
