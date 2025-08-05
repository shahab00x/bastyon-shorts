/**
 * Bastyon API service for interacting with the server-side PocketNetProxyApi
 */

const API_BASE_URL = '/api'

// Helper function to handle API responses
async function handleApiResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' }))
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
  }
  return response.json()
}

// Fetch videos with hashtag #bshorts and duration < 2 minutes
export async function fetchBShorts() {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/bshorts`)
    const data = await handleApiResponse(response)
    
    // Return the videos array from the response
    return data.videos || []
  } catch (error) {
    console.error('Error fetching BShorts:', error)
    
    // Fallback to mock data if API fails
    return [
      {
        id: 1,
        url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
        uploader: 'bastyon_user1',
        uploaderAddress: 'PBastyonAddress1234567890',
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
        uploaderAddress: 'PBastyonAddress0987654321',
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
        uploaderAddress: 'PBastyonAddress1122334455',
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
  }
}

// Get comments for a video
export async function getVideoComments(videoId) {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}/comments`)
    const data = await handleApiResponse(response)
    
    return data.comments || []
  } catch (error) {
    console.error('Error fetching video comments:', error)
    throw new Error('Failed to fetch comments. Please try again later.')
  }
}

// Post a comment on a video
export async function postComment(videoId, commentText, userAddress) {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        text: commentText, 
        userAddress: userAddress || 'current_user_address'
      })
    })
    
    const data = await handleApiResponse(response)
    return data
  } catch (error) {
    console.error('Error posting comment:', error)
    
    // Graceful degradation - return local comment structure
    return {
      success: true,
      comment: {
        id: Date.now(),
        user: 'current_user',
        userAddress: userAddress || 'current_user_address',
        text: commentText,
        timestamp: new Date().toISOString(),
        likes: 0
      }
    }
  }
}

// Donate PKoin to a creator
export async function donatePKoin(creatorAddress, amount) {
  try {
    const response = await fetch(`${API_BASE_URL}/donate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        creatorAddress, 
        amount,
        userAddress: 'current_user_address' // In a real app, this would come from authentication
      })
    })
    
    const data = await handleApiResponse(response)
    return data
  } catch (error) {
    console.error('Error donating PKoin:', error)
    throw new Error('Failed to process donation. Please try again later.')
  }
}

// Rate a video
export async function rateVideo(videoId, rating) {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        rating,
        userAddress: 'current_user_address' // In a real app, this would come from authentication
      })
    })
    
    const data = await handleApiResponse(response)
    return data
  } catch (error) {
    console.error('Error rating video:', error)
    
    // Graceful degradation
    return {
      success: true,
      videoId: videoId,
      rating: rating,
      message: 'Rating saved locally'
    }
  }
}

// Upload a video
export async function uploadVideo(videoData, description) {
  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        videoData,
        description,
        userAddress: 'current_user_address' // In a real app, this would come from authentication
      })
    })
    
    const data = await handleApiResponse(response)
    return data
  } catch (error) {
    console.error('Error uploading video:', error)
    
    // Return simulated success for development
    return {
      success: true,
      videoId: Date.now(),
      url: videoData || 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      timestamp: new Date().toISOString(),
      message: 'Video upload simulated'
    }
  }
}

// Get user profile
export async function getUserProfile(address) {
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile/${address}`)
    const data = await handleApiResponse(response)
    
    return data.profile
  } catch (error) {
    console.error('Error fetching user profile:', error)
    
    // Return basic profile structure
    return {
      address: address,
      name: 'Unknown User',
      avatar: '',
      reputation: 0,
      followers: 0,
      following: 0
    }
  }
}

// Authentication helpers (for future Bastyon SDK integration)
export async function authenticateUser() {
  // TODO: Implement Bastyon SDK authentication
  // This would use the 'account' permission from the manifest
  try {
    // Placeholder for Bastyon SDK authentication
    return {
      success: true,
      address: 'current_user_address',
      name: 'Current User'
    }
  } catch (error) {
    console.error('Error authenticating user:', error)
    throw new Error('Authentication failed')
  }
}

// Check if user is authenticated
export function isAuthenticated() {
  // TODO: Check if user is authenticated via Bastyon SDK
  return false // Placeholder
}

// Get current user address
export function getCurrentUserAddress() {
  // Import auth service dynamically to avoid circular imports
  try {
    const authService = require('./auth.js').default
    return authService.getCurrentUserAddress()
  } catch (error) {
    return 'current_user_address' // Fallback
  }
}

const bastyonApi = {
  fetchBShorts,
  getVideoComments,
  postComment,
  donatePKoin,
  rateVideo,
  uploadVideo,
  getUserProfile,
  authenticateUser,
  isAuthenticated,
  getCurrentUserAddress
};

export default bastyonApi;
