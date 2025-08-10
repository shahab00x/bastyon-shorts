// Try to extract a display name from various possible fields
function extractDisplayName(p: any): string | undefined {
  if (!p || typeof p !== 'object') return undefined
  return (
    p.name || p.nickname || p.nick || p.displayName || p.display_name ||
    p.profileName || p.username || undefined
  )
}

// Try to extract an avatar URL string from various fields (supports absolute URL or data URI)
function extractAvatarUrl(p: any): string | undefined {
  if (!p || typeof p !== 'object') return undefined
  const candidates = [
    p.avatar, p.i, p.image, p.icon, p.photo, p.picture,
    p?.profile?.avatar, p?.profile?.image,
  ].filter(Boolean)
  for (const c of candidates) {
    if (typeof c === 'string') return normalizeAvatarUrl(c)
    if (c && typeof c === 'object') {
      for (const key of ['url', 'src', 'original', 'large', 'small']) {
        const v = c[key]
        if (typeof v === 'string') return normalizeAvatarUrl(v)
      }
    }
  }
  return undefined
}

function normalizeAvatarUrl(url: string): string {
  try {
    if (!url) return url
    if (url.startsWith('data:')) return url
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    if (url.startsWith('/')) return `https://bastyon.com${url}`
    return url
  } catch {
    return url
  }
}
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

// Parse peertube://host/uuid and return { host, id } if possible
function parsePeerTubeUrl(url: string): { host: string, id: string } | null {
  try {
    if (!url || !url.startsWith('peertube://')) return null
    const parts = url.substring(11).split('/')
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { host: parts[0], id: parts[1] }
    }
  } catch {}
  return null
}

// Generic dedupe helper preserving order
function dedupeByHashArray<T>(arr: T[], getHash: (t: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const el of arr || []) {
    const h = getHash(el)
    if (!h) continue
    if (seen.has(h)) continue
    seen.add(h)
    out.push(el)
  }
  return out
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
    const debugProfiles = String(req.query.debugProfiles ?? '').toLowerCase() === '1' || String(req.query.debugProfiles ?? '').toLowerCase() === 'true'
    const base = process.env.PLAYLISTS_API_BASE || 'http://localhost:4040'
    const url = `${base}/playlists/${encodeURIComponent(lang)}?limit=${limit}&offset=${offset}`

    console.log(`Fetching playlists from ${url}`)
    let items: any[] = []
    try {
      const response = await axios.get(url, { timeout: 10000 })
      const data = response.data
      if (Array.isArray(data)) {
        items = data
      } else if (Array.isArray(data?.items)) {
        items = data.items
      } else {
        console.warn('Upstream playlists API returned unexpected shape for /bshorts:', typeof data, data && Object.keys(data))
        items = []
      }
      console.log(`Received ${items.length} playlist items`)
    } catch (e:any) {
      console.warn('Upstream playlists API failed, responding with empty list:', e?.message || e)
      items = []
    }

    // Dedupe upstream items by video_hash/hash to avoid repeated entries
    items = dedupeByHashArray(items, (it: any) => String(it?.video_hash ?? it?.hash ?? ''))

    let videos = items.map((item: any) => {
      const duration = Number(item?.peertube?.durationSeconds ?? 0) || 0
      const formattedDate = item?.timestamp
        ? new Date(item.timestamp * 1000).toLocaleDateString()
        : 'Unknown date'

      // Parse hashtags: supports JSON array string or space-separated string like "#news #crypto"
      let tags: string[] = []
      try {
        if (typeof item?.hashtags === 'string') {
          const s = item.hashtags.trim()
          if (s.startsWith('[')) {
            tags = JSON.parse(s)
          } else if (s.length) {
            tags = s.split(/\s+/).map((t: string) => t.replace(/^#/, '')).filter(Boolean)
          }
        }
      } catch (e) {
        console.warn('Failed to parse hashtags:', e)
        tags = []
      }

      // Ratings
      const score = Number(item?.ratings?.score ?? 0) || 0
      const ratingsCount = Number(item?.ratings?.ratingsCount ?? 0) || 0
      const averageRatingRaw = ratingsCount > 0 ? score / ratingsCount : 1
      const averageRating = Math.max(1, Math.min(5, averageRatingRaw))

      const author = item?.author || {}
      const topAuthorName = item.author_name
      const topAuthorAvatar = item.author_avatar
      const topAuthorRep = item.author_reputation
      return {
        id: item.video_hash,
        hash: item.video_hash,
        txid: item.video_hash,
        url: item.video_url, // keep peertube:// URL; client converts to direct MP4
        resolutions: [] as any[],
        uploader: topAuthorName || author?.name || author?.nickname || author?.nick || item?.author?.address || item.author_address || 'Unknown',
        uploaderAddress: item.author_address,
        description: item.caption || item.description || '',
        duration,
        timestamp: item?.timestamp ? new Date(item.timestamp * 1000).toISOString() : new Date().toISOString(),
        formattedDate,
        likes: score || item?.ratings?.ratingUp || 0,
        // Prefer comments_count; fallback to commentsCount or comments
        comments: typeof item?.comments_count === 'number'
          ? item.comments_count
          : (typeof item?.commentsCount === 'number' ? item.commentsCount : (typeof item?.comments === 'number' ? item.comments : 0)),
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
        uploaderAvatar: topAuthorAvatar ? normalizeAvatarUrl(topAuthorAvatar) : (author?.avatar ? normalizeAvatarUrl(author.avatar) : undefined),
        uploaderReputation: (typeof topAuthorRep === 'number' ? topAuthorRep : (typeof author?.reputation === 'number' ? author.reputation : (typeof author?.rep === 'number' ? author.rep : undefined))),
        views: undefined as number | undefined,
      }
    })

    // Dedupe mapped videos by hash/id/txid to ensure uniqueness
    videos = dedupeByHashArray(videos, (v: any) => String(v?.hash ?? v?.id ?? v?.txid ?? ''))

    // Enrich with Bastyon user profiles (best-effort)
    try {
      const pocketNetProxyInstance = await getPocketNetProxyInstance()
      const uniqueAddresses = Array.from(new Set(videos.map(v => v.uploaderAddress).filter(Boolean))) as string[]
      console.log(`Enriching ${uniqueAddresses.length} unique profiles via rpc.getuserprofile`)

      // Fetch profiles one-by-one to be safe with RPC shape
      const profileMap = new Map<string, any>()
      // For debugProfiles, store per-address attempt info
      const attemptLog: Record<string, any[]> = {}
      for (const addr of uniqueAddresses) {
        try {
          // Try several shapes to maximize compatibility across proxy versions
          let prof: any = null
          const rpcAny = pocketNetProxyInstance.rpc as any
          const attempts = [
            () => rpcAny.getuserprofile({ address: addr, shortForm: 'basic' }),
            () => rpcAny.getuserprofile({ address: addr, shortForm: 'yes' }),
            () => rpcAny.getuserprofile({ address: addr }),
            () => pocketNetProxyInstance.rpc.getuserprofile({ addresses: [addr] } as any),
          ]
          if (debugProfiles) attemptLog[addr] = []
          for (const attempt of attempts) {
            try {
              const resp = await attempt()
              prof = Array.isArray(resp) ? resp[0] : resp
              if (debugProfiles) attemptLog[addr].push({ ok: true, keys: prof ? Object.keys(prof) : [], note: Array.isArray(resp) ? 'array-first' : 'object' })
              if (prof) break
            } catch (err:any) {
              if (debugProfiles) attemptLog[addr].push({ ok: false, error: err?.message || String(err) })
            }
          }
          console.log("getuserprofile attempts: " , attempts.toString())
          if (prof) profileMap.set(addr, prof)
          else console.warn('Profile not found via RPC for address', addr)
        } catch (e) {
          console.warn(`getuserprofile failed for ${addr}:`, e instanceof Error ? e.message : e)
        }
      }

      videos = videos.map(v => {
        const prof = profileMap.get(v.uploaderAddress)
        if (prof) {
          const avatar = extractAvatarUrl(prof)
          const enriched: any = { ...v }
          if (!enriched.uploader || enriched.uploader === v.uploaderAddress || enriched.uploader === 'Unknown') {
            const name = extractDisplayName(prof)
            if (name) enriched.uploader = name
          }
          if (enriched.uploaderReputation == null) {
            const rep = prof?.reputation ?? prof?.rep
            if (typeof rep === 'number') enriched.uploaderReputation = rep
          }
          if (!enriched.uploaderAvatar && avatar) {
            enriched.uploaderAvatar = avatar
          }
          if (debugProfiles) {
            enriched.debugProfileRaw = prof
            enriched.debugProfileSourceAddress = v.uploaderAddress
            enriched.profileDebugAttempts = attemptLog[v.uploaderAddress] || []
          }
          return enriched
        }
        console.warn('No profile found for address', v.uploaderAddress)
        return v
      })

      // Fallback: if no profile reputation, try playlist rawPost.author.reputation
      videos = videos.map(v => {
        if ((v as any).uploaderReputation == null) {
          const rep = (v as any)?.rawPost?.author?.reputation
          if (typeof rep === 'number') {
            return { ...v, uploaderReputation: rep }
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
      const subset = videos.slice(0, Math.min(10, videos.length))
      await Promise.all(subset.map(async v => {
        try {
          const resp: any = await (pocketNetProxyInstance.rpc as any).getcomments({ hash: v.hash, limit: 50, offset: 0 })
          const rawComments: any[] = Array.isArray(resp) ? resp : (resp?.comments || resp?.data?.comments || [])
          const comments = rawComments.slice(0, 5).map(c => ({
            id: c?.id || c?.hash || String(Math.random()),
            user: c?.address?.substring(0, 8) || c?.user || 'Anonymous',
            text: typeof c?.msg === 'string' ? c.msg : (c?.message || ''),
            timestamp: c?.time ? new Date(c.time * 1000).toISOString() : undefined,
          }))
          v.commentData = comments
          if (debugProfiles) {
            (v as any).debugCommentsRaw = Array.isArray(resp) ? resp.slice(0, 5) : resp
          }
          if (typeof v.comments === 'number' && Number.isFinite((resp as any)?.commentscount)) {
            v.comments = (resp as any).commentscount
          } else if (typeof v.comments === 'number' && Number.isFinite(rawComments?.length)) {
            v.comments = rawComments.length
          }
        } catch (err) {
          console.warn('getcomments failed for', v.hash)
        }
      }))
    } catch (e) {
      console.warn('Comments enrichment skipped due to error:', e instanceof Error ? e.message : e)
    }

    // Enrich with PeerTube views (best-effort)
    try {
      const tasks = videos.map(async v => {
        const info = parsePeerTubeUrl(String(v.url || ''))
        if (!info) return
        const details = await fetchPeerTubeVideoDetails(info.host, info.id)
        try {
          // PeerTube v4+: views at details.views or details.stats.viewers/views
          const maybe = (details && (details.views ?? details?.stats?.viewers ?? details?.stats?.views))
          if (Number.isFinite(maybe)) {
            v.views = Number(maybe)
          }
        } catch {}
      })
      await Promise.allSettled(tasks)
    } catch (e) {
      console.warn('Views enrichment skipped due to error:', e instanceof Error ? e.message : e)
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

/**
 * GET /api/videos/profile
 *
 * Proxy to Bastyon RPC getuserprofile to fetch profile info (avatar, name, reputation)
 *
 * Query params:
 * - address: string (single address)
 * - addresses: string | string[] (comma-separated or repeated query entries)
 */
export async function getUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const qAddr = typeof req.query.address === 'string' ? req.query.address.trim() : ''
    const qAddrs = req.query.addresses
    let addresses: string[] = []

    if (qAddr) addresses.push(qAddr)
    if (Array.isArray(qAddrs)) {
      addresses.push(...qAddrs.flatMap(x => String(x).split(',').map(s => s.trim()).filter(Boolean)))
    } else if (typeof qAddrs === 'string' && qAddrs.trim()) {
      addresses.push(...qAddrs.split(',').map(s => s.trim()).filter(Boolean))
    }

    addresses = Array.from(new Set(addresses.filter(Boolean)))
    if (addresses.length === 0) {
      res.status(400).json({ message: 'Missing required query parameter: address or addresses' })
      return
    }

    const pocketNetProxyInstance = await getPocketNetProxyInstance()
    const rpcAny = pocketNetProxyInstance.rpc as any

    async function fetchOne(addr: string): Promise<any | null> {
      const attempts = [
        () => rpcAny.getuserprofile({ address: addr, shortForm: 'basic' }),
        () => rpcAny.getuserprofile({ address: addr, shortForm: 'yes' }),
        () => rpcAny.getuserprofile({ address: addr }),
        () => rpcAny.getuserprofile({ addresses: [addr] }),
      ]
      for (const attempt of attempts) {
        try {
          const resp = await attempt()
          const prof = Array.isArray(resp) ? resp[0] : resp
          if (prof) return prof
        } catch {}
      }
      return null
    }

    let results: any[] = []

    // Try batch first if multiple addresses
    if (addresses.length > 1) {
      try {
        const batchResp = await rpcAny.getuserprofile({ addresses })
        if (Array.isArray(batchResp) && batchResp.length) {
          results = batchResp
        }
      } catch {}
    }

    // Fallback to per-address fetching for any missing or if batch failed
    if (results.length === 0 || results.length < addresses.length) {
      const map = new Map<string, any>()
      for (const a of addresses) {
        const prof = await fetchOne(a)
        if (prof) map.set(a, prof)
      }
      results = addresses.map(a => map.get(a)).filter(Boolean)
    }

    const normalized = results.map((p: any) => {
      const avatar = extractAvatarUrl(p)
      const name = extractDisplayName(p)
      const reputation = typeof p?.reputation === 'number' ? p.reputation : (typeof p?.rep === 'number' ? p.rep : undefined)
      const address = p?.address || p?.id || p?.hash || undefined
      return { address, name, reputation, avatar, raw: p }
    })

    if (addresses.length === 1) {
      res.status(200).json(normalized[0] || null)
      return
    }
    res.status(200).json({
      count: normalized.length,
      profiles: normalized,
    })
  }
  catch (error) {
    console.error('Error fetching user profile(s):', error)
    res.status(500).json({
      message: 'Failed to fetch user profile(s)',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * GET /api/videos/comments
 *
 * Proxy to Bastyon RPC getcomments to fetch comments for a post hash.
 *
 * Query params:
 * - hash: string (video txid)
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - includeProfiles: boolean ("1"/"true" to enrich commenter profiles)
 */
export async function getComments(req: Request, res: Response): Promise<void> {
  try {
    const hash = typeof req.query.hash === 'string' ? req.query.hash.trim() : ''
    const limit = Number.parseInt(String(req.query.limit ?? '50'), 10) || 50
    const offset = Number.parseInt(String(req.query.offset ?? '0'), 10) || 0
    const includeProfiles = String(req.query.includeProfiles ?? '').toLowerCase() === '1' || String(req.query.includeProfiles ?? '').toLowerCase() === 'true'

    if (!hash) {
      res.status(400).json({ message: 'Missing required query parameter: hash' })
      return
    }

    const pocketNetProxyInstance = await getPocketNetProxyInstance()
    const rpcAny = pocketNetProxyInstance.rpc as any

    const resp: any = await rpcAny.getcomments({ hash, limit, offset })
    const rawComments: any[] = Array.isArray(resp) ? resp : (resp?.comments || resp?.data?.comments || [])
    const totalCount = (resp && (resp.commentscount ?? resp.count ?? rawComments.length)) || rawComments.length

    function extractText(msg: any): string {
      try {
        if (typeof msg === 'string') {
          const s = msg.trim()
          if (s.startsWith('{') && s.endsWith('}')) {
            const j = JSON.parse(s)
            return String(j?.message ?? j?.msg ?? '')
          }
          return s
        }
        if (msg && typeof msg === 'object') {
          return String(msg.message ?? msg.msg ?? '')
        }
      } catch {}
      return ''
    }

    const comments = rawComments.map((c: any) => {
      const addr = c?.address || c?.useraddress || c?.user || undefined
      return {
        id: c?.id || c?.hash || undefined,
        address: addr,
        user: typeof addr === 'string' ? `${addr.substring(0, 6)}…${addr.substring(addr.length - 4)}` : (c?.user || 'Anonymous'),
        text: extractText(c?.msg),
        timestamp: c?.time ? new Date(c.time * 1000).toISOString() : undefined,
        raw: c,
      }
    })

    const result: any = {
      hash,
      limit,
      offset,
      count: Number.isFinite(totalCount) ? Number(totalCount) : comments.length,
      comments,
    }

    if (includeProfiles) {
      const addrs = Array.from(new Set(comments.map((c: any) => c.address).filter(Boolean))) as string[]
      if (addrs.length) {
        const profilesMap: Record<string, any> = {}
        // Fetch in sequence to be safe
        for (const a of addrs) {
          try {
            const p = await (async () => {
              const attempts = [
                () => rpcAny.getuserprofile({ address: a, shortForm: 'basic' }),
                () => rpcAny.getuserprofile({ address: a, shortForm: 'yes' }),
                () => rpcAny.getuserprofile({ address: a }),
                () => rpcAny.getuserprofile({ addresses: [a] }),
              ]
              for (const attempt of attempts) {
                try {
                  const r = await attempt()
                  const prof = Array.isArray(r) ? r[0] : r
                  if (prof) return prof
                } catch {}
              }
              return null
            })()
            if (p) {
              profilesMap[a] = {
                address: a,
                name: extractDisplayName(p),
                reputation: typeof p?.reputation === 'number' ? p.reputation : (typeof p?.rep === 'number' ? p.rep : undefined),
                avatar: extractAvatarUrl(p),
              }
            }
          } catch {}
        }
        result.profiles = profilesMap
      }
    }

    res.status(200).json(result)
  }
  catch (error) {
    console.error('Error fetching comments:', error)
    res.status(500).json({
      message: 'Failed to fetch comments',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
