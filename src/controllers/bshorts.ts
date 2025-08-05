import type { Request, Response } from 'express'
import { getPocketNetProxyInstance } from '../lib'

/**
 * GET /api/videos/bshorts
 * 
 * Fetch all videos with duration < 120 seconds (2 minutes)
 * 
 * @param {Request} req - The incoming request object
 * @param {Response} res - The outgoing response object
 */

interface SearchParams {
  keyword: string;
  type: string;
  topBlock?: number;
  pageStart?: number;
  pageSize?: number;
  address?: string;
}

/**
 * GET /api/videos/bshorts
 * 
 * Fetch all videos with duration < 120 seconds (2 minutes)
 */
export async function getBShorts(req: Request, res: Response): Promise<void> {
  try {
    const pocketNetProxyInstance = await getPocketNetProxyInstance()
    
    // Try multiple keywords to get a broader range of content
    const keywords = ['video', 'media', 'short', 'clip', 'news']
    // const keywords = ['#bshorts']

    let allPosts: any[] = []
    
    // Search for posts using multiple keywords
    for (const keyword of keywords) {
      try {
        const searchResult = await pocketNetProxyInstance.rpc.search({
          keyword: keyword,
          type: 'videos', // Available types: posts, videos, videolink, tags, users
          pageStart: 0,
          pageSize: 1 // Reduced page size to avoid too many results
        } satisfies SearchParams)
        
        console.log(`Search result for keyword '${keyword}':`, JSON.stringify(searchResult, null, 2))
        console.log(`Extracted ${searchResult.data.posts.data.length} search results for keyword '${keyword}'`)
        // Extract posts from the response - handle various possible structures
        let posts = []
        if (searchResult) {
          // Check if searchResult itself is an array of posts
          if (Array.isArray(searchResult)) {
            posts = searchResult
          }
          // Check if searchResult.data.posts.data is an array of posts
          else if(searchResult.data.posts.data && Array.isArray(searchResult.data.posts.data)){
            posts = searchResult.data.posts.data
          }
          // Check if searchResult.data is an array of posts
          else if (searchResult.data && Array.isArray(searchResult.data)) {
            posts = searchResult.data
          }
          // Check if searchResult.data.posts is an array of posts
          else if (searchResult.data && searchResult.data.posts && Array.isArray(searchResult.data.posts)) {
            posts = searchResult.data.posts
          }
          // Check if searchResult.data.results is an array of posts
          else if (searchResult.data && searchResult.data.results && Array.isArray(searchResult.data.results)) {
            posts = searchResult.data.results
          }
          // Check if searchResult.data.items is an array of posts
          else if (searchResult.data && searchResult.data.items && Array.isArray(searchResult.data.items)) {
            posts = searchResult.data.items
          }
          // Check if searchResult.data.content is an array of posts
          else if (searchResult.data && searchResult.data.content && Array.isArray(searchResult.data.content)) {
            posts = searchResult.data.content
          }
          // Check if searchResult.data.feeds is an array of posts
          else if (searchResult.data && searchResult.data.feeds && Array.isArray(searchResult.data.feeds)) {
            posts = searchResult.data.feeds
          }
          // If we have an object with post-like properties, treat it as a single post
          else if (searchResult.hash || searchResult.txid) {
            posts = [searchResult]
          }
          // If we have a data object with post-like properties, treat it as a single post
          else if (searchResult.data && (searchResult.data.hash || searchResult.data.txid)) {
            posts = [searchResult.data]
          }
        }
        
        console.log(`Extracted ${posts.length} posts for keyword '${keyword}'`)
        
        // Add posts to our collection, avoiding duplicates
        for (const post of posts) {
          // Check if we already have this post
          const exists = allPosts.some(p => (p.hash && p.hash === post.hash) || (p.txid && p.txid === post.txid))
          if (!exists && (post.hash || post.txid)) {
            allPosts.push(post)
          }
        }
        
        // Don't overload the API with too many requests
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Error searching with keyword '${keyword}':`, error)
      }
    }
    
    console.log(`Found ${allPosts.length} unique posts from all keywords`)
    
    // For now, we'll use the posts directly from search results
    // since they contain the video URLs we need
    // TODO: Later we can implement video duration checking
    const detailedPosts = allPosts
    
    console.log(`Retrieved ${detailedPosts.length} detailed posts`)
    
    // Filter for videos under 2 minutes (120 seconds)
    // Be more flexible with duration filtering
    const shortVideos = detailedPosts.filter((post: any) => {
      // For video content, check if it has video-related fields
      const hasVideo = post.s?.videos || post.s?.v || (post.type === 'video') || post.u || 
                      (post.m && (post.m.includes('peertube')))
      
      // Check if we have a video URL
      const hasVideoUrl = post.u && post.u.includes('peertube')
      
      // TODO: Implement proper video duration checking from the peertube site
      // For now, we'll include videos with peertube URLs and assume they're shorts
      // We can add actual duration checking later
      const isShortDuration = hasVideoUrl  // Placeholder - will implement real duration checking later
      
      console.log(`Post ${post.hash || post.txid}: hasVideo=${hasVideo}, hasVideoUrl=${hasVideoUrl}, isShort=${isShortDuration}`)
      
      return hasVideo && (hasVideoUrl || isShortDuration)
    })
    
    // Format the response based on actual Bastyon post structure
    const formattedVideos = shortVideos.map((post: any) => {
      return {
        id: post.txid || post.hash,
        hash: post.hash,
        txid: post.txid,
        url: post.u ? safeDecodeURIComponent(post.u) : '', // 'u' field contains URL
        uploader: post.userprofile?.name || post.userprofile?.nick || 'Unknown',
        uploaderAddress: post.address,
        description: post.m ? safeDecodeURIComponent(post.m) : '', // 'm' field contains message
        duration: post.duration || 0,
        timestamp: post.time ? new Date(post.time * 1000).toISOString() : new Date().toISOString(), // Convert Unix timestamp
        likes: post.scoreSum || post.likes || 0,
        comments: post.comments || 0,
        type: post.type,
        tags: post.t ? post.t.map((tag: string) => safeDecodeURIComponent(tag)) : [],
        language: post.l,
        // Video-related fields if available
        hasVideo: !!(post.s?.videos || post.s?.v || post.u),
        videoInfo: post.s,
        // Include raw post data for debugging
        rawPost: post
      };
    })
    
    res.status(200).json({
      message: 'Short videos retrieved successfully',
      data: formattedVideos,
      total: formattedVideos.length,
      debug: {
        totalPostsFound: allPosts.length,
        detailedPosts: detailedPosts.length,
        filteredResults: shortVideos.length,
        searchKeywords: keywords
      }
    })
    
  } catch (error) {
    console.error('Error fetching short videos:', error)
    res.status(500).json({
      message: 'Failed to retrieve short videos',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Safe decodeURIComponent function to avoid errors
function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch (error) {
    console.error('Error decoding URI component:', error);
    return str;
  }
}

/**
 * Placeholder function for future complex playlist compilation algorithm
 * This function will be expanded to compile playlists based on various hashtags
 * 
 * @param hashtags - Array of hashtags to include in the playlist
 * @param maxDuration - Maximum duration of videos in seconds
 * @param limit - Maximum number of videos to return
 * @returns Promise resolving to an array of video objects
 */
export async function compilePlaylistByHashtags(hashtags: string[], maxDuration: number = 120, limit: number = 50): Promise<any[]> {
  // TODO: Implement complex algorithm for compiling playlists based on hashtags
  // This is a placeholder that will be expanded in the future
  console.log(`Compiling playlist for hashtags: ${hashtags.join(', ')}`)
  
  // For now, return empty array as placeholder
  return []
}

/**
 * Placeholder function for advanced video filtering algorithm
 * This function will implement more sophisticated filtering based on multiple criteria
 * 
 * @param videos - Array of video objects to filter
 * @param criteria - Filtering criteria object
 * @returns Promise resolving to filtered array of video objects
 */
export async function advancedVideoFilter(videos: any[], criteria: any): Promise<any[]> {
  // TODO: Implement advanced filtering algorithm
  // This is a placeholder that will be expanded in the future
  console.log('Applying advanced video filtering')
  
  // For now, return original array as placeholder
  return videos
}

/**
 * Placeholder function for video recommendation algorithm
 * This function will implement recommendation logic based on user preferences
 * 
 * @param userAddress - User's Bastyon address
 * @param preferences - User's video preferences
 * @param limit - Maximum number of recommendations
 * @returns Promise resolving to an array of recommended video objects
 */
export async function recommendVideos(userAddress: string, preferences: any, limit: number = 20): Promise<any[]> {
  // TODO: Implement video recommendation algorithm
  // This is a placeholder that will be expanded in the future
  console.log(`Generating recommendations for user: ${userAddress}`)
  
  // For now, return empty array as placeholder
  return []
}

/**
 * POST /api/videos/comment
 * 
 * Post a comment on a video
 * 
 * @param {Request} req - The incoming request object
 * @param {Response} res - The outgoing response object
 */
export async function postComment(req: Request, res: Response): Promise<void> {
  try {
    const { videoId, commentText, userAddress } = req.body
    
    if (!videoId || !commentText || !userAddress) {
      res.status(400).json({
        message: 'Missing required fields: videoId, commentText, userAddress'
      })
      return
    }
    
    // Get the initialized instance of PocketNetProxyApi
    const pocketNetProxyInstance = await getPocketNetProxyInstance()
    
    // Post comment using Bastyon API
    // Note: This is a placeholder - actual implementation would depend on Bastyon API
    // Using addtransaction method which is available in the RPC methods
    const result = await pocketNetProxyInstance.rpc.addtransaction({
      param1: 'comment_data',
      param2: {
        type: 'comment',
        posttxid: videoId,
        comment: commentText,
        address: userAddress
      }
    })
    
    res.status(201).json({
      message: 'Comment posted successfully',
      data: result
    })
  } catch (error) {
    console.error('Error posting comment:', error)
    res.status(500).json({
      message: 'Failed to post comment',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * POST /api/videos/rate
 * 
 * Rate a video
 * 
 * @param {Request} req - The incoming request object
 * @param {Response} res - The outgoing response object
 */
export async function rateVideo(req: Request, res: Response): Promise<void> {
  try {
    const { videoId, rating, userAddress } = req.body
    
    if (!videoId || rating === undefined || !userAddress) {
      res.status(400).json({
        message: 'Missing required fields: videoId, rating, userAddress'
      })
      return
    }
    
    // Validate rating (1-5)
    if (rating < 1 || rating > 5) {
      res.status(400).json({
        message: 'Rating must be between 1 and 5'
      })
      return
    }
    
    // Get the initialized instance of PocketNetProxyApi
    const pocketNetProxyInstance = await getPocketNetProxyInstance()
    
    // Rate video using Bastyon API
    // Note: This is a placeholder - actual implementation would depend on Bastyon API
    // Using addtransaction method which is available in the RPC methods
    const result = await pocketNetProxyInstance.rpc.addtransaction({
      param1: 'rating_data',
      param2: {
        type: 'rating',
        posttxid: videoId,
        rating: rating,
        address: userAddress
      }
    })
    
    res.status(200).json({
      message: 'Video rated successfully',
      data: result
    })
  } catch (error) {
    console.error('Error rating video:', error)
    res.status(500).json({
      message: 'Failed to rate video',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * POST /api/donate
 * 
 * Donate PKoin to a creator
 * 
 * @param {Request} req - The incoming request object
 * @param {Response} res - The outgoing response object
 */
export async function donatePKoin(req: Request, res: Response): Promise<void> {
  try {
    const { creatorAddress, amount, userAddress } = req.body
    
    if (!creatorAddress || !amount || !userAddress) {
      res.status(400).json({
        message: 'Missing required fields: creatorAddress, amount, userAddress'
      })
      return
    }
    
    // Validate amount
    if (amount <= 0) {
      res.status(400).json({
        message: 'Amount must be greater than 0'
      })
      return
    }
    
    // Get the initialized instance of PocketNetProxyApi
    const pocketNetProxyInstance = await getPocketNetProxyInstance()
    
    // Donate PKoin using Bastyon API
    // Note: This is a placeholder - actual implementation would depend on Bastyon API
    // Using addtransaction method which is available in the RPC methods
    const result = await pocketNetProxyInstance.rpc.addtransaction({
      param1: 'donation_data',
      param2: {
        type: 'donation',
        address: creatorAddress,
        amount: amount,
        from: userAddress
      }
    })
    
    res.status(200).json({
      message: 'Donation successful',
      data: result
    })
  } catch (error) {
    console.error('Error processing donation:', error)
    res.status(500).json({
      message: 'Failed to process donation',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * POST /api/videos/upload
 * 
 * Upload a video
 * 
 * @param {Request} req - The incoming request object
 * @param {Response} res - The outgoing response object
 */
export async function uploadVideo(req: Request, res: Response): Promise<void> {
  try {
    // In a real implementation, you would handle file uploads
    // This is a simplified version that assumes video data is in the request body
    const { videoData, description, userAddress } = req.body
    
    if (!videoData || !description || !userAddress) {
      res.status(400).json({
        message: 'Missing required fields: videoData, description, userAddress'
      })
      return
    }
    
    // Get the initialized instance of PocketNetProxyApi
    const pocketNetProxyInstance = await getPocketNetProxyInstance()
    
    // Upload video using Bastyon API
    // Note: This is a placeholder - actual implementation would depend on Bastyon API
    // and would need to handle file uploads properly
    // Using addtransaction method which is available in the RPC methods
    const result = await pocketNetProxyInstance.rpc.addtransaction({
      param1: 'video_data',
      param2: {
        type: 'post',
        content: `${description} #news`,
        address: userAddress
        // In a real implementation, you would include the actual video file
      }
    })
    
    res.status(201).json({
      message: 'Video uploaded successfully',
      data: result
    })
  } catch (error) {
    console.error('Error uploading video:', error)
    res.status(500).json({
      message: 'Failed to upload video',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
