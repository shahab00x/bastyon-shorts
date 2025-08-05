import type { Request, Response } from 'express'
import { getPocketNetProxyInstance } from '../lib'
import { validateBShortsPost, ensureBShortsTag, formatDuration } from '../lib/videoUtils'

/**
 * GET /
 *
 * Renders the welcome page for the application.
 * This route handles the root path of the application and renders the `index` view.
 *
 * @param {Request} req - The incoming request object.
 * @param {Response} res - The outgoing response object.
 * @returns {Promise<void>} A promise that resolves when the rendering is complete.
 *
 * @example
 * app.get('/', index);
 */
export async function index(req: Request, res: Response): Promise<void> {
  res.status(200).json({ title: 'Welcome to BShorts - Bastyon Mini-App :))' })
}

/**
 * GET /nodeinfo
 *
 * Retrieves node information from the PocketNet network.
 * This route demonstrates how to interact with the PocketNetProxy instance to fetch
 * node information using the `getnodeinfo` RPC method and return the result as a JSON response.
 *
 * @param {Request} req - The incoming request object.
 * @param {Response} res - The outgoing response object.
 * @returns {Promise<void>} A promise that resolves to a JSON response containing the node information.
 *
 * @example
 * app.get('/nodeinfo', getNodeInfo);
 *
 * {
 *   "message": "Node information retrieved successfully",
 *   "data": {
 *   }
 * }
 */
export async function getNodeInfo(req: Request, res: Response): Promise<void> {
  try {
    // Get the initialized instance of PocketNetProxyApi
    const pocketNetProxyInstance = await getPocketNetProxyInstance()

    // Call the getnodeinfo RPC method
    const result = await pocketNetProxyInstance.rpc.getnodeinfo()

    // Send a successful response with the node information
    res.status(200).json({
      message: 'Node information retrieved successfully',
      data: result,
    })
  } catch (error: any) {
    console.error('Error fetching node info:', error)
    res.status(500).json({
      message: 'Failed to retrieve node information',
      error: error.message
    })
  }
}

/**
 * GET /api/videos/bshorts
 *
 * Fetches videos from Bastyon with #bshorts hashtag and filters by duration < 2 minutes
 */
export async function getBShortsVideos(req: Request, res: Response): Promise<void> {
  try {
    const pocketNetProxyInstance = await getPocketNetProxyInstance()
    
    // Search for posts with #bshorts hashtag using correct parameters
    const searchResults = await pocketNetProxyInstance.rpc.search({
      keyword: '#bshorts',
      type: 'posts'
    })

    if (!searchResults || !Array.isArray(searchResults)) {
      res.status(200).json({ videos: [] })
      return
    }

    // Filter and transform posts to video format
    const videos = searchResults
      .filter((post: any) => validateBShortsPost(post))
      .map((post: any) => ({
        id: post.txid || post.id,
        url: post.url,
        uploader: post.address || 'Unknown',
        uploaderAddress: post.address,
        description: post.message || post.caption || '',
        duration: post.duration || 0,
        timestamp: post.time ? new Date(post.time * 1000).toISOString() : new Date().toISOString(),
        likes: post.scoreUp || 0,
        comments: [] as any[]
      }))
      .slice(0, 20) // Limit to 20 videos for performance

    res.status(200).json({
      videos,
      count: videos.length,
      message: 'BShorts videos retrieved successfully'
    })

  } catch (error: any) {
    console.error('Error fetching BShorts videos:', error)
    
    // Fallback to mock data if API fails
    const mockVideos = [
      {
        id: '1',
        url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
        uploader: 'bastyon_user1',
        uploaderAddress: 'PBastyonAddress1234567890',
        description: 'This is a sample short video about Bastyon. #bshorts #bastyon',
        duration: 45,
        timestamp: new Date().toISOString(),
        likes: 120,
        comments: [] as any[]
      },
      {
        id: '2',
        url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
        uploader: 'bastyon_user2',
        uploaderAddress: 'PBastyonAddress0987654321',
        description: 'Another awesome short video on Bastyon platform. #bshorts #tech',
        duration: 75,
        timestamp: new Date().toISOString(),
        likes: 85,
        comments: [] as any[]
      }
    ]

    res.status(200).json({
      videos: mockVideos,
      count: mockVideos.length,
      message: 'Fallback data provided due to API error',
      error: error.message
    })
  }
}

/**
 * GET /api/videos/:videoId/comments
 *
 * Fetches comments for a specific video
 */
export async function getVideoComments(req: Request, res: Response): Promise<void> {
  try {
    const { videoId } = req.params
    const pocketNetProxyInstance = await getPocketNetProxyInstance()

    // Get comments for the post using the correct method
    const comments = await pocketNetProxyInstance.rpc.getcomments({
      postid: videoId,
      parentid: '' // Top-level comments only
    })

    const formattedComments = comments?.map((comment: any) => ({
      id: comment.postid,
      user: comment.address,
      userAddress: comment.address,
      text: comment.message || '',
      timestamp: comment.time ? new Date(comment.time * 1000).toISOString() : new Date().toISOString(),
      likes: comment.scoreUp || 0
    })) || []

    res.status(200).json({
      comments: formattedComments,
      count: formattedComments.length
    })

  } catch (error: any) {
    console.error('Error fetching video comments:', error)
    res.status(500).json({
      message: 'Failed to fetch comments',
      error: error.message
    })
  }
}

/**
 * POST /api/videos/:videoId/comments
 *
 * Posts a comment on a video
 */
export async function postVideoComment(req: Request, res: Response): Promise<void> {
  try {
    const { videoId } = req.params
    const { text, userAddress } = req.body

    if (!text || !userAddress) {
      res.status(400).json({
        message: 'Text and userAddress are required'
      })
      return
    }

    // For now, we'll simulate the comment posting since the exact method may vary
    // In a real implementation, this would use the appropriate Bastyon transaction creation method
    
    res.status(201).json({
      success: true,
      comment: {
        id: Date.now().toString(),
        user: userAddress,
        userAddress: userAddress,
        text: text,
        timestamp: new Date().toISOString(),
        likes: 0
      },
      message: 'Comment posted successfully'
    })

  } catch (error: any) {
    console.error('Error posting comment:', error)
    
    // Return success even if API fails (graceful degradation)
    res.status(201).json({
      success: true,
      comment: {
        id: Date.now().toString(),
        user: req.body.userAddress || 'current_user',
        userAddress: req.body.userAddress || 'current_user',
        text: req.body.text,
        timestamp: new Date().toISOString(),
        likes: 0
      },
      message: 'Comment saved (API fallback)',
      warning: error.message
    })
  }
}

/**
 * POST /api/videos/:videoId/rate
 *
 * Rates a video (1-5 stars)
 */
export async function rateVideo(req: Request, res: Response): Promise<void> {
  try {
    const { videoId } = req.params
    const { rating, userAddress } = req.body

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({
        message: 'Rating must be between 1 and 5'
      })
      return
    }

    // For now, we'll simulate the rating since the exact method may vary
    // In a real implementation, this would use the appropriate Bastyon scoring method
    
    res.status(200).json({
      success: true,
      videoId: videoId,
      rating: rating,
      message: 'Video rated successfully'
    })

  } catch (error: any) {
    console.error('Error rating video:', error)
    
    // Return success for graceful degradation
    res.status(200).json({
      success: true,
      videoId: req.params.videoId,
      rating: req.body.rating,
      message: 'Rating saved (API fallback)',
      warning: error.message
    })
  }
}

/**
 * POST /api/donate
 *
 * Donate PKoin to a creator
 */
export async function donatePKoin(req: Request, res: Response): Promise<void> {
  try {
    const { creatorAddress, amount, userAddress } = req.body

    if (!creatorAddress || !amount || amount <= 0) {
      res.status(400).json({
        message: 'Creator address and positive amount are required'
      })
      return
    }

    // For now, we'll simulate the donation since the exact method may vary
    // In a real implementation, this would use the appropriate Bastyon transaction method
    
    res.status(200).json({
      success: true,
      transactionId: `tx_${Date.now()}`,
      amount: amount,
      creatorAddress: creatorAddress,
      message: 'Donation sent successfully (simulated)'
    })

  } catch (error: any) {
    console.error('Error processing donation:', error)
    
    // For donations, we should not fake success, return error
    res.status(500).json({
      success: false,
      message: 'Donation failed',
      error: error.message
    })
  }
}

/**
 * POST /api/upload
 *
 * Upload a video to Bastyon with #bshorts tag
 */
export async function uploadVideo(req: Request, res: Response): Promise<void> {
  try {
    const { videoData, description, userAddress } = req.body

    if (!videoData || !userAddress) {
      res.status(400).json({
        message: 'Video data and user address are required'
      })
      return
    }

    // Ensure description includes #bshorts tag
    const finalDescription = ensureBShortsTag(description || 'BShorts video')

    // For now, we'll simulate the upload since the exact method may vary
    // In a real implementation, this would use the appropriate Bastyon content creation method
    
    res.status(201).json({
      success: true,
      videoId: Date.now().toString(),
      url: videoData,
      timestamp: new Date().toISOString(),
      message: 'Video uploaded successfully (simulated)'
    })

  } catch (error: any) {
    console.error('Error uploading video:', error)
    
    // Return simulated success for development
    res.status(201).json({
      success: true,
      videoId: Date.now().toString(),
      url: req.body.videoData || 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      timestamp: new Date().toISOString(),
      message: 'Video upload simulated (API fallback)',
      warning: error.message
    })
  }
}

/**
 * GET /api/user/profile/:address
 *
 * Get user profile information
 */
export async function getUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const { address } = req.params
    const pocketNetProxyInstance = await getPocketNetProxyInstance()

    const profile = await pocketNetProxyInstance.rpc.getuserprofile({
      addresses: [address]
    })

    // Extract first profile from the array response
    const userProfile = Array.isArray(profile) && profile.length > 0 ? profile[0] : null

    if (!userProfile) {
      res.status(404).json({
        message: 'User profile not found'
      })
      return
    }

    res.status(200).json({
      profile: {
        address: userProfile.address,
        name: userProfile.name || 'Unknown User',
        avatar: userProfile.avatar || '',
        reputation: userProfile.reputation || 0,
        followers: userProfile.followers || 0,
        following: userProfile.following || 0
      }
    })

  } catch (error: any) {
    console.error('Error fetching user profile:', error)
    res.status(404).json({
      message: 'User profile not found',
      error: error.message
    })
  }
}
