const axios = require('axios');

async function testEndpoint() {
  try {
    const response = await axios.get('http://localhost:3030/api/videos/bshorts');
    console.log('Response status:', response.status);
    console.log('Number of videos:', response.data.length);
    
    // Log the first video to see its structure
    if (response.data.length > 0) {
      console.log('First video:', JSON.stringify(response.data[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testEndpoint();
