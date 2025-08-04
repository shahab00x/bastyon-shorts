// Bastyon API service for interacting with the server-side PocketNetProxyApi

const API_BASE_URL = '/api'

// Fetch videos with hashtag #bshorts and duration < 2 minutes
export async function fetchBShorts() {
  try {
    // In a real implementation, this would call the server-side API
    // For now, we'll return mock data
    
    // Example of what the real API call would look like:
    // const response = await fetch(`${API_BASE_URL}/videos/bshorts`)
    // const data = await response.json()
    // return data
    
    // Mock data for demonstration
    return [
      {
        id: 1,
        url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
        uploader: 'bastyon_user1',
        uploaderAddress: 'BastyonAddress1234567890',
        description: 'This is a sample short video about Bastyon. #bshorts #bastyon',
        duration: 45, // in seconds
        timestamp: '2023-05-15T10:30:00Z',
        likes: 120,
        comments: [
          { id: 1, user: 'user2', userAddress: 'UserAddress0987654321', text: 'Great video!', timestamp: '2023-05-15T11:00:00Z' },
          { id: 2, user: 'user3', userAddress: 'UserAddress1122334455', text: 'Thanks for sharing', timestamp: '2023-05-15T11:15:00Z' }
        ]
      },
      {
        id: 2,
        url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
        uploader: 'bastyon_user2',
        uploaderAddress: 'BastyonAddress0987654321',
        description: 'Another awesome short video on Bastyon platform. #bshorts #tech',
        duration: 75, // in seconds
        timestamp: '2023-05-14T14:20:00Z',
        likes: 85,
        comments: [
          { id: 1, user: 'user1', userAddress: 'UserAddress5566778899', text: 'Love this!', timestamp: '2023-05-14T15:00:00Z' }
        ]
      },
      {
        id: 3,
        url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
        uploader: 'bastyon_creator',
        uploaderAddress: 'BastyonAddress1122334455',
        description: 'Creating amazing content for the Bastyon community. #bshorts #content',
        duration: 65, // in seconds
        timestamp: '2023-05-13T09:45:00Z',
        likes: 210,
        comments: [
          { id: 1, user: 'user4', userAddress: 'UserAddress9988776655', text: 'Incredible work!', timestamp: '2023-05-13T10:30:00Z' },
          { id: 2, user: 'user5', userAddress: 'UserAddress4455667788', text: 'Can you make more of these?', timestamp: '2023-05-13T11:00:00Z' }
        ]
      }
    ]
  } catch (error) {
    console.error('Error fetching BShorts:', error)
    throw new Error('Failed to fetch videos. Please try again later.')
  }
}

// Post a comment on a video
export async function postComment(videoId, commentText, userAddress) {
  try {
    // In a real implementation, this would call the server-side API
    // For now, we'll simulate the API call
    
    // Example of what the real API call would look like:
    // const response = await fetch(`${API_BASE_URL}/videos/${videoId}/comments`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ text: commentText, userAddress })
    // })
    // 
    // if (!response.ok) {
    //   throw new Error(`HTTP error! status: ${response.status}`)
    // }
    // 
    // const data = await response.json()
    // return data
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Simulate successful comment posting
    return {
      success: true,
      comment: {
        id: Date.now(),
        user: 'current_user',
        userAddress: userAddress,
        text: commentText,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('Error posting comment:', error)
    throw new Error('Failed to post comment. Please try again later.')
  }
}

// Donate PKoin to a creator
export async function donatePKoin(creatorAddress, amount) {
  try {
    // In a real implementation, this would call the server-side API
    // For now, we'll simulate the API call
    
    // Example of what the real API call would look like:
    // const response = await fetch(`${API_BASE_URL}/donate`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ creatorAddress, amount })
    // })
    // 
    // if (!response.ok) {
    //   throw new Error(`HTTP error! status: ${response.status}`)
    // }
    // 
    // const data = await response.json()
    // return data
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Simulate successful donation
    return {
      success: true,
      transactionId: 'tx_' + Date.now(),
      amount: amount,
      creatorAddress: creatorAddress
    }
  } catch (error) {
    console.error('Error donating PKoin:', error)
    throw new Error('Failed to process donation. Please try again later.')
  }
}

// Rate a video
export async function rateVideo(videoId, rating) {
  try {
    // In a real implementation, this would call the server-side API
    // For now, we'll simulate the API call
    
    // Example of what the real API call would look like:
    // const response = await fetch(`${API_BASE_URL}/videos/${videoId}/rate`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ rating })
    // })
    // 
    // if (!response.ok) {
    //   throw new Error(`HTTP error! status: ${response.status}`)
    // }
    // 
    // const data = await response.json()
    // return data
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Simulate successful rating
    return {
      success: true,
      videoId: videoId,
      rating: rating
    }
  } catch (error) {
    console.error('Error rating video:', error)
    throw new Error('Failed to rate video. Please try again later.')
  }
}

// Upload a video
export async function uploadVideo(videoData) {
  try {
    // In a real implementation, this would call the server-side API
    // For now, we'll simulate the API call
    
    // Example of what the real API call would look like:
    // const response = await fetch(`${API_BASE_URL}/upload`, {
    //   method: 'POST',
    //   body: videoData
    // })
    // 
    // if (!response.ok) {
    //   throw new Error(`HTTP error! status: ${response.status}`)
    // }
    // 
    // const data = await response.json()
    // return data
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Simulate successful upload
    return {
      success: true,
      videoId: Date.now(),
      url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error uploading video:', error)
    throw new Error('Failed to upload video. Please try again later.')
  }
}

export default {
  fetchBShorts,
  postComment,
  donatePKoin,
  rateVideo,
  uploadVideo
}
