import type { Request, Response } from 'express'
import axios from 'axios'
import { getPocketNetProxyInstance } from '../lib'

// Function to fetch PeerTube video details
async function fetchPeerTubeVideoDetails(host: string, videoId: string) {
  try {
    const response = await axios.get(`https://${host}/api/v1/videos/${videoId}`)
    return response.data
  }
  catch (error) {
    console.error(`Error fetching PeerTube video details for ${videoId}:`, error)
    return null
  }
}

// Function to convert peertube:// URLs to direct video URLs
function convertPeerTubeUrlToDirect(url: string): string {
  if (url.startsWith('peertube://')) {
    try {
      // Extract host and UUID from peertube://host/uuid format
      const parts = url.substring(11).split('/') // Remove 'peertube://' prefix
      if (parts.length >= 2) {
        const hostName = parts[0]
        const videoId = parts[1]
        
        // Return direct video URL
        return `https://${hostName}/download/streaming-playlists/hls/videos/${videoId}-360-fragmented.mp4`
      }
    } catch (error) {
      console.error('Error converting PeerTube URL:', error)
      // Return original URL if conversion fails
      return url
    }
  }

  // Return original URL if it's not a peertube:// URL
  return url
}

/**
 * GET /api/videos/bshorts
 *
 * Fetch all videos with duration < 120 seconds (2 minutes)
 *
 * @param {Request} req - The incoming request object
 * @param {Response} res - The outgoing response object
 */

interface SearchParams {
  keyword: string
  type: string
  topBlock?: number
  pageStart?: number
  pageSize?: number
  address?: string
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
    const keywords = ['video', 'media', 'short', 'clip', 'news', '#video', '#truth']

    let allPosts: any[] = []
    let posts: any[] = []

    console.log('Starting search for BShorts...')

    // Search for posts using multiple keywords
    for (const keyword of keywords) {
      try {
        console.log(`Searching for keyword: ${keyword}`)
        const searchResult = await pocketNetProxyInstance.rpc.search({
          keyword,
          type: 'videos', // Available types: posts, videos, videolink, tags, users
          pageStart: 0,
          pageSize: 5, // Increased page size to get more results
        } satisfies SearchParams)

        console.log(`Search result structure for keyword '${keyword}':`, Object.keys(searchResult || {}))
        
        if (searchResult && searchResult.data) {
          console.log(`Search result data structure:`, Object.keys(searchResult.data))
          
          // Log the full structure for debugging
          if (searchResult.data.posts) {
            console.log(`Posts structure:`, Object.keys(searchResult.data.posts))
            if (searchResult.data.posts.data) {
              console.log(`Found ${searchResult.data.posts.data.length} posts for keyword '${keyword}'`)
              console.log(`Sample post structure:`, searchResult.data.posts.data.length > 0 ? Object.keys(searchResult.data.posts.data[0]) : 'No posts')
              posts = searchResult.data.posts.data
            }
          }
        } else {
          console.log(`No search result for keyword '${keyword}'`)
        }
        
        allPosts = allPosts.concat(posts)
      }
      catch (error) {
        console.error(`Error searching for keyword '${keyword}':`, error)
        // Continue with next keyword if one fails
      }
    }
    
    console.log(`Total posts collected: ${allPosts.length}`)
    
    // If we still don't have posts, let's try getting all videos without filtering
    if (allPosts.length === 0) {
      try {
        console.log('Trying to get all videos without keyword filtering...')
        const searchResult = await pocketNetProxyInstance.rpc.search({
          keyword: '#truth',
          type: 'videos',
          pageStart: 0,
          pageSize: 10,
        } satisfies SearchParams)
        
        if (searchResult && searchResult.data && searchResult.data.posts && searchResult.data.posts.data) {
          allPosts = searchResult.data.posts.data
          console.log(`Found ${allPosts.length} posts without keyword filtering`)
        }
      } catch (error) {
        console.error('Error getting all videos:', error)
      }
    }
    
    posts = allPosts

    // Deduplicate posts by txid or hash
    const seenIds = new Set()
    const uniquePosts = posts.filter((post) => {
      const id = post.txid || post.hash || post.id
      if (!id) return true; // Keep posts without IDs for now
      if (seenIds.has(id)) {
        return false
      }
      seenIds.add(id)
      return true
    })
    
    console.log(`Posts after deduplication: ${uniquePosts.length}`)

    // Let's first see what we have before filtering
    console.log(`Sample post before filtering:`, uniquePosts.length > 0 ? uniquePosts[0] : 'No posts')
    
    // Filter for short videos (under 5 minutes) and format data
    // Using a more lenient filter for debugging
    const shortVideos = uniquePosts
      .filter((post: any) => {
        // Log the duration for debugging
        console.log(`Post duration: ${post.duration}, type: ${typeof post.duration}`)
        console.log(`Full post structure for duration debugging:`, JSON.stringify({
          duration: post.duration,
          s: post.s,
          videoInfo: post.videoInfo,
          rawPost: post.rawPost ? { s: post.rawPost.s } : 'no rawPost'
        }, null, 2))
        
        // Accept posts with duration < 300 seconds (5 minutes) for debugging
        // Also accept posts without duration for now
        return !post.duration || post.duration < 300
      })
      .slice(0, 20) // Limit to 20 videos for debugging
      .map(async (post: any) => {
        // Extract video URL from various possible fields
        let videoUrl = post.u || post.s?.u || post.url || ''
        let videoResolutions = []

        // Handle PeerTube URLs by converting to direct URLs
        // First decode the URL if it's encoded
        try {
          // Only attempt to decode if the URL appears to be encoded
          if (videoUrl && (videoUrl.includes('%3A') || videoUrl.includes('%2F'))) {
            videoUrl = decodeURIComponent(videoUrl);
          }
        } catch (e) {
          // If decoding fails, continue with original URL
          console.log('Failed to decode URL:', videoUrl);
        }
        
        videoUrl = convertPeerTubeUrlToDirect(videoUrl)

        // If it's still a PeerTube URL, try fetching details from PeerTube API as fallback
        if (videoUrl.startsWith('peertube://')) {
          // Extract host and UUID from peertube://host/uuid format
          const urlParts = videoUrl.substring(11).split('/') // Remove 'peertube://' prefix
          if (urlParts.length >= 2) {
            const host = urlParts[0]
            const videoId = urlParts[1]

            // Fetch video details from PeerTube API
            const videoDetails = await fetchPeerTubeVideoDetails(host, videoId)
            if (videoDetails) {
              // Use the first available file URL
              if (videoDetails.files && videoDetails.files.length > 0) {
                videoUrl = videoDetails.files[0].fileUrl
              }
              // Add streaming playlist files for download options
              if (videoDetails.streamingPlaylists && videoDetails.streamingPlaylists.length > 0 && videoDetails.streamingPlaylists[0].files) {
                // Include resolution information for download options
                videoResolutions = videoDetails.streamingPlaylists[0].files
              } else if (videoDetails.files) {
                // Fallback to direct files if streaming playlists not available
                videoResolutions = videoDetails.files
              }
            }
          }
        }

        // Format the date for display
        const formattedDate = post.time ? new Date(post.time * 1000).toLocaleDateString() : 'Unknown date'

        // Extract comments if available
        const comments = []
        if (post.lastComment) {
          try {
            // First try to decode the message
            let decodedMsg = post.lastComment.msg;
            try {
              decodedMsg = safeDecodeURIComponent(post.lastComment.msg);
            } catch (decodeError) {
              // If decoding fails, continue with original message
              console.log('Failed to decode comment message');
            }
            
            // Then try to parse as JSON
            const commentMsg = decodedMsg ? JSON.parse(decodedMsg) : {};
            comments.push({
              id: post.lastComment.id,
              user: post.lastComment.address?.substring(0, 8) || 'Anonymous',
              text: commentMsg.message ? safeDecodeURIComponent(commentMsg.message) : '',
              timestamp: post.lastComment.time ? new Date(post.lastComment.time * 1000).toLocaleDateString() : 'Unknown date',
            })
          }
          catch (e) {
            console.error('Error parsing comment:', e)
            // Add a basic comment entry even if parsing fails
            comments.push({
              id: post.lastComment.id,
              user: post.lastComment.address?.substring(0, 8) || 'Anonymous',
              text: 'Unable to parse comment',
              timestamp: post.lastComment.time ? new Date(post.lastComment.time * 1000).toLocaleDateString() : 'Unknown date',
            })
          }
        }

        // Try to extract duration from various possible sources
        let duration = post.duration || 0;
        
        // Check if duration is in the video metadata
        if (!duration && post.s && typeof post.s === 'object') {
          // Check common duration fields in video metadata
          if (post.s.duration) {
            duration = post.s.duration;
          } else if (post.s.v && typeof post.s.v === 'object' && post.s.v.duration) {
            duration = post.s.v.duration;
          } else if (post.s.videos && Array.isArray(post.s.videos) && post.s.videos.length > 0) {
            // If videos is an array, check first video for duration
            const firstVideo = post.s.videos[0];
            if (firstVideo && firstVideo.duration) {
              duration = firstVideo.duration;
            } else if (firstVideo && firstVideo.d) {
              // Sometimes duration is stored as 'd' field
              duration = firstVideo.d;
            } else if (firstVideo && firstVideo.l) {
              // Sometimes duration is stored as 'l' field (length)
              duration = firstVideo.l;
            }
          }
        }
        
        // If we still don't have duration, check rawPost
        if (!duration && post.rawPost && post.rawPost.s && typeof post.rawPost.s === 'object') {
          if (post.rawPost.s.duration) {
            duration = post.rawPost.s.duration;
          } else if (post.rawPost.s.v && typeof post.rawPost.s.v === 'object' && post.rawPost.s.v.duration) {
            duration = post.rawPost.s.v.duration;
          } else if (post.rawPost.s.videos && Array.isArray(post.rawPost.s.videos) && post.rawPost.s.videos.length > 0) {
            // Check rawPost videos array
            const firstVideo = post.rawPost.s.videos[0];
            if (firstVideo && firstVideo.duration) {
              duration = firstVideo.duration;
            } else if (firstVideo && firstVideo.d) {
              duration = firstVideo.d;
            } else if (firstVideo && firstVideo.l) {
              duration = firstVideo.l;
            }
          }
        }
        
        // Convert duration to number if it's a string
        if (typeof duration === 'string') {
          duration = Number.parseFloat(duration);
        }
        
        // If duration is NaN, set it to 0
        if (Number.isNaN(duration)) {
          duration = 0;
        }

        return {
          id: post.txid || post.hash || post.id,
          hash: post.hash,
          txid: post.txid,
          url: videoUrl, // 'u' field contains URL, converted if it's a PeerTube URL
          resolutions: videoResolutions, // Available resolutions for download
          uploader: post.userprofile?.name || post.userprofile?.nick || post.address || 'Unknown',
          uploaderAddress: post.address,
          description: post.m ? safeDecodeURIComponent(post.m) : (post.description || ''), // 'm' field contains message
          duration: duration,
          timestamp: post.time ? new Date(post.time * 1000).toISOString() : new Date().toISOString(), // Convert Unix timestamp
          formattedDate, // Human-readable date
          likes: post.scoreSum || post.likes || post.rating || 0,
          comments: post.comments || 0,
          commentData: comments, // Actual comment data
          type: post.type || 'video',
          tags: post.t ? post.t.map((tag: string) => safeDecodeURIComponent(tag)) : (post.tags || []),
          language: post.l || post.language,
          // Video-related fields if available
          hasVideo: !!(post.s?.videos || post.s?.v || post.u || post.url),
          videoInfo: post.s,
          // Include raw post data for debugging
          rawPost: post,
        }
      })

    // Resolve all promises for async operations
    const resolvedVideos = await Promise.all(shortVideos)

    console.log(`Sending ${resolvedVideos.length} videos`)
    
    // Send the formatted short videos
    res.json(resolvedVideos)
  }
  catch (error) {
    console.error('Error fetching short videos:', error)
    res.status(500).json({
      message: 'Failed to retrieve short videos',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// Safe decodeURIComponent function to avoid errors
function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str)
  }
  catch (error) {
    console.error('Error decoding URI component:', error)
    return str
  }
}

/**
 * Placeholder function for future complex playlist compilation algorithm
 * This function will be expanded to compile playlists based on various hashtags
 *
 * @param hashtags - Array of hashtags to include in the playlist
 * @param _maxDuration - Maximum duration of videos in seconds
 * @param _limit - Maximum number of videos to return
 * @returns Promise resolving to an array of video objects
 */
async function compilePlaylistByHashtags(hashtags: string[], _maxDuration: number = 120, _limit: number = 50): Promise<any[]> {
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
async function advancedVideoFilter(videos: any[], _criteria: any): Promise<any[]> {
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
 * @param _preferences - User's video preferences
 * @param _limit - Maximum number of recommendations
 * @returns Promise resolving to an array of recommended video objects
 */
async function recommendVideos(userAddress: string, _preferences: any, _limit: number = 20): Promise<any[]> {
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
        message: 'Missing required fields: videoId, commentText, userAddress',
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
        address: userAddress,
      },
    })

    res.status(201).json({
      message: 'Comment posted successfully',
      data: result,
    })
  }
  catch (error) {
    console.error('Error posting comment:', error)
    res.status(500).json({
      message: 'Failed to post comment',
      error: error instanceof Error ? error.message : 'Unknown error',
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
        message: 'Missing required fields: videoId, rating, userAddress',
      })
      return
    }

    // Validate rating (1-5)
    if (rating < 1 || rating > 5) {
      res.status(400).json({
        message: 'Rating must be between 1 and 5',
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
        rating,
        address: userAddress,
      },
    })

    res.status(200).json({
      message: 'Video rated successfully',
      data: result,
    })
  }
  catch (error) {
    console.error('Error rating video:', error)
    res.status(500).json({
      message: 'Failed to rate video',
      error: error instanceof Error ? error.message : 'Unknown error',
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
        message: 'Missing required fields: creatorAddress, amount, userAddress',
      })
      return
    }

    // Validate amount
    if (amount <= 0) {
      res.status(400).json({
        message: 'Amount must be greater than 0',
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
        amount,
        from: userAddress,
      },
    })

    res.status(200).json({
      message: 'Donation successful',
      data: result,
    })
  }
  catch (error) {
    console.error('Error processing donation:', error)
    res.status(500).json({
      message: 'Failed to process donation',
      error: error instanceof Error ? error.message : 'Unknown error',
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
        message: 'Missing required fields: videoData, description, userAddress',
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
        address: userAddress,
        // In a real implementation, you would include the actual video file
      },
    })

    res.status(201).json({
      message: 'Video uploaded successfully',
      data: result,
    })
  }
  catch (error) {
    console.error('Error uploading video:', error)
    res.status(500).json({
      message: 'Failed to upload video',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
