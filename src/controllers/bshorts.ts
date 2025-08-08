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
    const lang = typeof req.query.lang === 'string' ? req.query.lang : 'en'
    const limit = Number.parseInt(String(req.query.limit ?? '20'), 10) || 20
    const offset = Number.parseInt(String(req.query.offset ?? '0'), 10) || 0
    const base = process.env.PLAYLISTS_API_BASE || 'http://localhost:4040'
    const url = `${base}/playlists/${encodeURIComponent(lang)}?limit=${limit}&offset=${offset}`

    console.log(`Fetching playlists from ${url}`)
    const response = await axios.get(url, { timeout: 10000 })
    const payload = response.data || {}

    const items: any[] = Array.isArray(payload.items) ? payload.items : []
    console.log(`Received ${items.length} playlist items`)

    let videos = items.map((item: any) => {
      const duration = Number(item?.peertube?.durationSeconds ?? 0) || 0
      const formattedDate = item?.timestamp
        ? new Date(item.timestamp * 1000).toLocaleDateString()
        : 'Unknown date'

      // Parse hashtags field which comes as a JSON-encoded string
      let tags: string[] = []
      try {
        if (typeof item?.hashtags === 'string' && item.hashtags.trim().startsWith('[')) {
          tags = JSON.parse(item.hashtags)
        }
      } catch (e) {
        console.warn('Failed to parse hashtags JSON:', e)
        tags = []
      }

      // Ratings
      const score = Number(item?.ratings?.score ?? 0) || 0
      const ratingsCount = Number(item?.ratings?.ratingsCount ?? 0) || 0
      const averageRatingRaw = ratingsCount > 0 ? score / ratingsCount : 1
      const averageRating = Math.max(1, Math.min(5, averageRatingRaw))

      return {
        id: item.video_hash,
        hash: item.video_hash,
        txid: item.video_hash,
        url: item.video_url, // keep peertube:// URL; client converts to direct MP4
        resolutions: [] as any[],
        uploader: item?.author?.address || item.author_address || 'Unknown',
        uploaderAddress: item.author_address,
        description: item.caption || item.description || '',
        duration,
        timestamp: item?.timestamp ? new Date(item.timestamp * 1000).toISOString() : new Date().toISOString(),
        formattedDate,
        likes: score || item?.ratings?.ratingUp || 0,
        // Keep comments as-is from source if present; do not overwrite with ratingsCount
        comments: typeof item?.commentsCount === 'number' ? item.commentsCount : (typeof item?.comments === 'number' ? item.comments : 0),
        ratingsCount,
        averageRating,
        userRating: averageRating,
        commentData: [] as any[],
        type: 'video',
        tags,
        language: item.language,
        hasVideo: !!item.video_url,
        videoInfo: { peertube: item.peertube },
        rawPost: item,
        // Optional extra fields
        bastyonPostLink: item.bastyon_post_link,
      }
    })

    // Enrich with Bastyon user profiles (best-effort)
    try {
      const pocketNetProxyInstance = await getPocketNetProxyInstance()
      const uniqueAddresses = Array.from(new Set(videos.map(v => v.uploaderAddress).filter(Boolean))) as string[]
      console.log(`Enriching ${uniqueAddresses.length} unique profiles via rpc.getuserprofile`)

      // Fetch profiles one-by-one to be safe with RPC shape
      const profileMap = new Map<string, any>()
      for (const addr of uniqueAddresses) {
        try {
          // Prefer address + shortForm per user's example
          let prof: any = null
          try {
            // Cast to any to allow { address, shortForm } shape without TS error
            prof = await (pocketNetProxyInstance.rpc as any).getuserprofile({ address: addr, shortForm: 'yes' })
          } catch (e1) {
            // Fallback to addresses array shape
            const resp = await pocketNetProxyInstance.rpc.getuserprofile({ addresses: [addr] } as any)
            prof = Array.isArray(resp) ? resp[0] : resp
          }
          if (prof) profileMap.set(addr, prof)
        } catch (e) {
          console.warn(`getuserprofile failed for ${addr}:`, e instanceof Error ? e.message : e)
        }
      }

      videos = videos.map(v => {
        const prof = profileMap.get(v.uploaderAddress)
        if (prof) {
          return {
            ...v,
            uploader: prof?.name || prof?.nick || v.uploader,
            uploaderReputation: prof?.reputation ?? prof?.rep ?? undefined,
            uploaderAvatar: prof?.avatar || prof?.i || undefined,
          }
        }
        return v
      })
    } catch (e) {
      console.warn('Profile enrichment skipped due to error:', e instanceof Error ? e.message : e)
    }

    // Enrich with a small set of comments via Bastyon RPC (best-effort, non-fatal)
    try {
      const pocketNetProxyInstance = await getPocketNetProxyInstance()
      // Limit comment enrichment to first 10 items to keep latency low
      const subset = videos.slice(0, Math.min(10, videos.length))
      await Promise.all(subset.map(async v => {
        try {
          // Use the user's suggested param shape
          const content: any = await (pocketNetProxyInstance.rpc as any).getcontent({ postTxHash: v.hash })
          const comments: any[] = []
          const rawComments = content?.comments || content?.data?.comments || []
          for (const c of rawComments.slice(0, 5)) {
            comments.push({
              id: c?.id || c?.hash || String(Math.random()),
              user: c?.address?.substring(0, 8) || c?.user || 'Anonymous',
              text: typeof c?.msg === 'string' ? c.msg : (c?.message || ''),
              timestamp: c?.time ? new Date(c.time * 1000).toISOString() : undefined,
            })
          }
          v.commentData = comments
          if (typeof v.comments === 'number' && Number.isFinite(content?.commentscount)) {
            v.comments = content.commentscount
          }
        } catch (err) {
          // Non-fatal
          console.warn('getcontent failed for', v.hash)
        }
      }))
    } catch (e) {
      console.warn('Comments enrichment skipped due to error:', e instanceof Error ? e.message : e)
    }

    // Respond with the mapped & enriched videos
    res.json(videos)
  } catch (error) {
    console.error('Error fetching short videos from playlists API:', error)
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
