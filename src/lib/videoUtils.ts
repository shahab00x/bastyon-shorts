/**
 * Video utility functions for BShorts
 */

// Maximum duration for BShorts videos (2 minutes in seconds)
export const MAX_BSHORTS_DURATION = 120

/**
 * Check if a video qualifies as a BShorts video based on duration
 */
export function isBShortsVideo(duration: number): boolean {
  return duration > 0 && duration <= MAX_BSHORTS_DURATION
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  if (remainingSeconds === 0) {
    return `${minutes}m`
  }
  
  return `${minutes}m ${remainingSeconds}s`
}

/**
 * Validate video post for BShorts requirements
 */
export function validateBShortsPost(post: any): boolean {
  // Must be a video post
  if (post.type !== 'video') {
    return false
  }
  
  // Must have a URL
  if (!post.url) {
    return false
  }
  
  // Must have valid duration
  if (!post.duration || !isBShortsVideo(post.duration)) {
    return false
  }
  
  // Should contain #bshorts hashtag (case insensitive)
  const message = (post.message || post.caption || '').toLowerCase()
  if (!message.includes('#bshorts')) {
    return false
  }
  
  return true
}

/**
 * Extract hashtags from a message
 */
export function extractHashtags(message: string): string[] {
  const hashtagRegex = /#[\w]+/g
  const matches = message.match(hashtagRegex)
  return matches ? matches.map(tag => tag.toLowerCase()) : []
}

/**
 * Check if message contains BShorts hashtag
 */
export function containsBShortsTag(message: string): boolean {
  const hashtags = extractHashtags(message)
  return hashtags.includes('#bshorts')
}

/**
 * Add BShorts hashtag to message if not present
 */
export function ensureBShortsTag(message: string): string {
  if (!containsBShortsTag(message)) {
    return `${message} #bshorts`.trim()
  }
  return message
}

/**
 * Get video file size estimate (for upload validation)
 */
export function estimateVideoSize(duration: number, quality: 'low' | 'medium' | 'high' = 'medium'): number {
  // Rough estimates in MB based on common bitrates
  const bitrates = {
    low: 1, // ~1 Mbps
    medium: 2.5, // ~2.5 Mbps  
    high: 5 // ~5 Mbps
  }
  
  const bitrate = bitrates[quality]
  return (duration * bitrate * 0.125) // Convert to MB (bitrate * time * (1 byte / 8 bits))
}

/**
 * Validate video upload size
 */
export function isValidUploadSize(sizeInMB: number, maxSizeMB: number = 100): boolean {
  return sizeInMB > 0 && sizeInMB <= maxSizeMB
}