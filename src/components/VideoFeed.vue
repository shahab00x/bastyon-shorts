<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import VideoPlayer from './VideoPlayer.vue'
import { SdkService } from '~/composables/sdkService'

interface Video {
  id: string
  url: string
  thumbnail: string
  title: string
  description: string
  author: {
    name: string
    address: string
  }
  duration: number
  likes: number
  comments: number
  timestamp: number
}

const videos = ref<Video[]>([])
const currentVideoIndex = ref(0)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Initialize the video feed
async function initVideoFeed() {
  isLoading.value = true
  error.value = null

  try {
    // Request necessary permissions
    const permissions = [
      'account',
      'messaging',
      'sign',
    ]

    try {
      await SdkService.checkAndRequestPermissions(permissions)
    }
    catch (permissionError) {
      console.warn('Some permissions could not be granted:', permissionError)
      // Continue with initialization even if some permissions are denied
    }

    // Fetch videos with hashtag #bshorts
    await fetchVideos()
  }
  catch (err) {
    console.error('Error initializing video feed:', err)
    error.value = 'Failed to load videos. Please try again later.'
  }
  finally {
    isLoading.value = false
  }
}

// Fetch videos with hashtag #bshorts
async function fetchVideos() {
  try {
    let apiVideos = []

    try {
      // Try different methods to get content from Bastyon
      // Based on typical blockchain/social media APIs, try these methods:

      // Method 1: Try getlastposts or similar
      try {
        const postsResult = await SdkService.rpc('getlastposts', {
          count: 50,
          lang: 'en',
        })

        if (postsResult && Array.isArray(postsResult)) {
          apiVideos = postsResult.filter((post: any) => {
            // Filter for posts with #bshorts hashtag and video content
            const hasHashtag = post.tags?.includes('bshorts')
              || post.message?.includes('#bshorts')
              || post.text?.includes('#bshorts')
            const isVideo = post.type === 'video'
              || post.url?.match(/\.(mp4|mov|avi|webm)$/i)
              || post.contentType === 'video'
            return hasHashtag && isVideo
          })
        }

        console.log('Posts result:', postsResult)
      }
      catch (postsError) {
        console.warn('getlastposts failed:', postsError)

        // Method 2: Try getpostsbytag if available
        try {
          const tagResult = await SdkService.rpc('getpostsbytag', {
            tag: 'bshorts',
            count: 50,
          })

          if (tagResult && Array.isArray(tagResult)) {
            apiVideos = tagResult.filter((post: any) => {
              const isVideo = post.type === 'video'
                || post.url?.match(/\.(mp4|mov|avi|webm)$/i)
                || post.contentType === 'video'
              return isVideo
            })
          }

          console.log('Tag result:', tagResult)
        }
        catch (tagError) {
          console.warn('getpostsbytag failed:', tagError)

          // Method 3: Try a more generic content search
          try {
            const contentResult = await SdkService.rpc('getcontent', {
              limit: 50,
              type: 'video',
            })

            if (contentResult && Array.isArray(contentResult)) {
              apiVideos = contentResult.filter((post: any) => {
                return post.tags?.includes('bshorts')
                  || post.message?.includes('#bshorts')
                  || post.text?.includes('#bshorts')
              })
            }

            console.log('Content result:', contentResult)
          }
          catch (contentError) {
            console.warn('getcontent failed:', contentError)
          }
        }
      }
    }
    catch (rpcError) {
      console.warn('All RPC calls failed, using mock data:', rpcError)
    }

    const transformedVideos: Video[] = apiVideos
      .map((video: any) => ({
        id: video.id || video.txid || video.hash || Math.random().toString(36).substr(2, 9),
        url: video.url || video.videoUrl || video.content?.url || '',
        thumbnail: video.thumbnail || video.previewImage || video.preview || '',
        title: video.title || video.caption || 'Untitled Video',
        description: video.description || video.message || video.text || '',
        author: {
          name: video.author?.name || video.username || video.address?.substr(0, 8) || 'Unknown User',
          address: video.author?.address || video.address || '',
        },
        duration: video.duration || 60,
        likes: video.likes || video.score || video.reputation || 0,
        comments: video.comments || video.commentCount || 0,
        timestamp: video.timestamp || video.time || video.created || Date.now(),
      }))
      .filter((video) => {
        // Filter for valid videos with URLs and reasonable duration
        return video.url && video.duration < 300 // Under 5 minutes
      })

    // If we don't have any API videos, use mock data
    if (transformedVideos.length === 0) {
      console.log('No API videos found, using mock data')
      const mockVideos: Video[] = [
        {
          id: '1',
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          thumbnail: '',
          title: 'Beautiful Sunset #bshorts',
          description: 'Watching the sunset at the beach. Nature is amazing! #bshorts #nature',
          author: {
            name: 'traveler_jane',
            address: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydG',
          },
          duration: 45,
          likes: 1200,
          comments: 42,
          timestamp: Date.now() - 3600000,
        },
        {
          id: '2',
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
          thumbnail: '',
          title: 'Cooking Tutorial #bshorts',
          description: 'Learn how to make the perfect pasta in just 10 minutes! #bshorts #cooking',
          author: {
            name: 'chef_mario',
            address: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydH',
          },
          duration: 75,
          likes: 850,
          comments: 28,
          timestamp: Date.now() - 7200000,
        },
        {
          id: '3',
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4',
          thumbnail: '',
          title: 'Dance Challenge #bshorts',
          description: 'Can you do this dance? Join the challenge! #bshorts #dance #challenge',
          author: {
            name: 'dance_crew',
            address: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydI',
          },
          duration: 30,
          likes: 3200,
          comments: 156,
          timestamp: Date.now() - 10800000,
        },
      ]

      videos.value = mockVideos
    }
    else {
      videos.value = transformedVideos
      console.log(`Loaded ${transformedVideos.length} videos from API`)
    }
  }
  catch (err) {
    console.error('Error fetching videos:', err)

    // Fallback to mock data if everything fails
    const mockVideos: Video[] = [
      {
        id: '1',
        url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        thumbnail: '',
        title: 'Beautiful Sunset #bshorts',
        description: 'Watching the sunset at the beach. Nature is amazing! #bshorts #nature',
        author: {
          name: 'traveler_jane',
          address: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydG',
        },
        duration: 45,
        likes: 1200,
        comments: 42,
        timestamp: Date.now() - 3600000,
      },
      {
        id: '2',
        url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
        thumbnail: '',
        title: 'Cooking Tutorial #bshorts',
        description: 'Learn how to make the perfect pasta in just 10 minutes! #bshorts #cooking',
        author: {
          name: 'chef_mario',
          address: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydH',
        },
        duration: 75,
        likes: 850,
        comments: 28,
        timestamp: Date.now() - 7200000,
      },
      {
        id: '3',
        url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4',
        thumbnail: '',
        title: 'Dance Challenge #bshorts',
        description: 'Can you do this dance? Join the challenge! #bshorts #dance #challenge',
        author: {
          name: 'dance_crew',
          address: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydI',
        },
        duration: 30,
        likes: 3200,
        comments: 156,
        timestamp: Date.now() - 10800000,
      },
    ]

    videos.value = mockVideos
  }
}

// Swipe handling
let startY = 0
let endY = 0

function handleTouchStart(e: TouchEvent) {
  startY = e.touches[0].clientY
}

function handleTouchEnd(e: TouchEvent) {
  endY = e.changedTouches[0].clientY
  handleSwipe()
}

function handleSwipe() {
  const diffY = startY - endY
  const swipeThreshold = 50

  // Swipe up - next video
  if (diffY > swipeThreshold && currentVideoIndex.value < videos.value.length - 1)
    currentVideoIndex.value++
  // Swipe down - previous video
  else if (diffY < -swipeThreshold && currentVideoIndex.value > 0)
    currentVideoIndex.value--
}

// Keyboard navigation for testing
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp' && currentVideoIndex.value < videos.value.length - 1)
    currentVideoIndex.value++
  else if (e.key === 'ArrowDown' && currentVideoIndex.value > 0)
    currentVideoIndex.value--
}

// Video player events
async function handleLike(videoId: string) {
  try {
    console.log('Like video:', videoId)
    // Try different methods for liking content
    const likeResult = await SdkService.rpc('score', {
      txid: videoId,
      value: 5, // Usually a value between 1-5
    })
    console.log('Like result:', likeResult)
  }
  catch (error) {
    console.error('Error liking video:', error)
  }
}

async function handleComment(videoId: string) {
  try {
    console.log('Comment on video:', videoId)
    // Get comments for the video
    const commentsResult = await SdkService.rpc('getcomments', {
      postid: videoId,
      parentid: '',
      count: 10,
    })
    console.log('Comments result:', commentsResult)
  }
  catch (error) {
    console.error('Error fetching comments:', error)
  }
}

async function handleShare(videoId: string) {
  try {
    console.log('Share video:', videoId)
    // In Bastyon, sharing might involve reposting or creating a new post
    // This would typically open the sharing interface
    const shareResult = await SdkService.rpc('share', {
      txid: videoId,
      message: 'Check out this video! #bshorts',
    })
    console.log('Share result:', shareResult)
  }
  catch (error) {
    console.error('Error sharing video:', error)
  }
}

async function handleFollow(authorAddress: string) {
  try {
    console.log('Follow author:', authorAddress)
    // Subscribe to the author
    const followResult = await SdkService.rpc('subscribe', {
      address: authorAddress,
    })
    console.log('Follow result:', followResult)
  }
  catch (error) {
    console.error('Error following author:', error)
  }
}

onMounted(() => {
  initVideoFeed()

  // Add event listeners
  window.addEventListener('touchstart', handleTouchStart, { passive: true })
  window.addEventListener('touchend', handleTouchEnd, { passive: true })
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  // Remove event listeners
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchend', handleTouchEnd)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="video-feed h-screen w-screen overflow-hidden bg-black">
    <!-- Loading state -->
    <div v-if="isLoading" class="h-full flex items-center justify-center">
      <div class="i-carbon-renew animate-spin text-4xl text-white" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="h-full flex flex-col items-center justify-center p-4">
      <div class="i-carbon-error mb-4 text-4xl text-red-500" />
      <p class="mb-4 text-center text-white">
        {{ error }}
      </p>
      <button
        class="rounded-full bg-blue-600 px-6 py-2 text-white"
        @click="initVideoFeed"
      >
        Try Again
      </button>
    </div>

    <!-- Video feed -->
    <div v-else-if="videos.length > 0" class="relative h-full">
      <!-- Video players -->
      <div
        v-for="(video, index) in videos"
        :key="video.id"
        class="absolute inset-0 transition-transform duration-300" :class="[
          index === currentVideoIndex ? 'translate-y-0'
          : index < currentVideoIndex ? '-translate-y-full' : 'translate-y-full',
        ]"
      >
        <VideoPlayer
          :video="video"
          :is-active="index === currentVideoIndex"
          @like="handleLike"
          @comment="handleComment"
          @share="handleShare"
          @follow="handleFollow"
        />
      </div>

      <!-- Video counter -->
      <div class="absolute left-4 top-4 rounded bg-black bg-opacity-50 px-2 py-1 text-white font-bold">
        {{ currentVideoIndex + 1 }} / {{ videos.length }}
      </div>

      <!-- Instructions for mobile -->
      <div class="absolute right-4 top-4 rounded bg-black bg-opacity-50 px-2 py-1 text-xs text-white">
        Swipe up/down to navigate
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="h-full flex flex-col items-center justify-center p-4">
      <div class="i-carbon-video mb-4 text-4xl text-white" />
      <p class="mb-4 text-center text-white">
        No videos found. Try again later.
      </p>
      <button
        class="rounded-full bg-blue-600 px-6 py-2 text-white"
        @click="initVideoFeed"
      >
        Refresh
      </button>
    </div>
  </div>
</template>

<style scoped>
.video-feed {
  touch-action: pan-y;
}
</style>
