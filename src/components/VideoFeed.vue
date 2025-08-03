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
    // This is a placeholder implementation - in a real app, you would use the Bastyon SDK
    // to fetch actual videos
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
    // Update the search method call to match the documentation
    let apiVideos = []

    try {
      // Test if basic RPC calls work
      const nodeInfo = await SdkService.rpc('getnodeinfo')
      console.log('Node info:', nodeInfo)

      // Try the search method with correct parameters based on documentation
      try {
        const result = await SdkService.rpc('search', {
          keyword: '#bshorts',
          type: 'content',
          pageStart: 0,
          pageSize: 50,
        })

        // Safely extract videos from the result
        apiVideos = Array.isArray((result as any)?.data?.results)
          ? (result as any).data.results
          : Array.isArray((result as any)?.data)
            ? (result as any).data
            : []

        console.log('Search results:', result)
      }
      catch (searchError) {
        console.warn('Search method failed:', searchError)

        // Try with minimal parameters
        try {
          const simpleResult = await SdkService.rpc('search', {
            keyword: '#bshorts',
          })

          // Safely extract videos from the result
          apiVideos = Array.isArray((simpleResult as any)?.data?.results)
            ? (simpleResult as any).data.results
            : Array.isArray((simpleResult as any)?.data)
              ? (simpleResult as any).data
              : []

          console.log('Simple search results:', simpleResult)
        }
        catch (simpleSearchError) {
          console.warn('Simple search also failed:', simpleSearchError)
        }
      }
    }
    catch (rpcError) {
      console.warn('Basic RPC calls failed, using mock data:', rpcError)
      // If the RPC call fails, we'll use mock data
    }

    const transformedVideos: Video[] = apiVideos
      .filter((video: any) => {
        // Filter for video content and short duration
        const isVideo = video.contentType === 'video' || video.url?.includes('.mp4') || video.url?.includes('.mov')
        const duration = video.duration || 60 // Default to 60 seconds if not provided
        return isVideo && duration < 120 // Filter videos under 2 minutes
      })
      .map((video: any) => ({
        id: video.id || video.txId || Math.random().toString(36).substr(2, 9),
        url: video.url || '',
        thumbnail: video.thumbnail || video.previewImage || '',
        title: video.title || 'Untitled Video',
        description: video.description || video.text || '',
        author: {
          name: video.author?.name || video.username || 'Unknown User',
          address: video.author?.address || video.userAddress || '',
        },
        duration: video.duration || 60,
        likes: video.likes || video.rating || 0,
        comments: video.comments || video.commentCount || 0,
        timestamp: video.timestamp || video.created || Date.now(),
      }))

    // If we don't have any API videos, use mock data
    if (transformedVideos.length === 0) {
      const mockVideos: Video[] = [
        {
          id: '1',
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          thumbnail: '',
          title: 'Beautiful Sunset',
          description: 'Watching the sunset at the beach. Nature is amazing!',
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
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          thumbnail: '',
          title: 'Cooking Tutorial',
          description: 'Learn how to make the perfect pasta in just 10 minutes!',
          author: {
            name: 'chef_mario',
            address: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydG',
          },
          duration: 75,
          likes: 850,
          comments: 28,
          timestamp: Date.now() - 7200000,
        },
        {
          id: '3',
          url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
          thumbnail: '',
          title: 'Dance Challenge',
          description: 'Can you do this dance? Join the challenge and show us your moves!',
          author: {
            name: 'dance_crew',
            address: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydG',
          },
          duration: 30,
          likes: 3200,
          comments: 156,
          timestamp: Date.now() - 10800000,
        },
      ]

      videos.value = mockVideos.filter(video => video.duration < 120)
    }
    else {
      videos.value = transformedVideos
    }
  }
  catch (err) {
    console.error('Error fetching videos:', err)
    // Fallback to mock data if API call fails
    const mockVideos: Video[] = [
      {
        id: '1',
        url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        thumbnail: '',
        title: 'Beautiful Sunset',
        description: 'Watching the sunset at the beach. Nature is amazing!',
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
        url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        thumbnail: '',
        title: 'Cooking Tutorial',
        description: 'Learn how to make the perfect pasta in just 10 minutes!',
        author: {
          name: 'chef_mario',
          address: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydG',
        },
        duration: 75,
        likes: 850,
        comments: 28,
        timestamp: Date.now() - 7200000,
      },
      {
        id: '3',
        url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
        thumbnail: '',
        title: 'Dance Challenge',
        description: 'Can you do this dance? Join the challenge and show us your moves!',
        author: {
          name: 'dance_crew',
          address: 'TQsidN3F7qcctiJ1Y5FgZnTjzQqQCt6ydG',
        },
        duration: 30,
        likes: 3200,
        comments: 156,
        timestamp: Date.now() - 10800000,
      },
    ]

    videos.value = mockVideos.filter(video => video.duration < 120)
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
    // Use the Bastyon SDK to like the video
    // Example: await SdkService.rpc('like', [videoId])
  }
  catch (error) {
    console.error('Error liking video:', error)
  }
}

async function handleComment(videoId: string) {
  try {
    console.log('Comment on video:', videoId)
    // Use the Bastyon SDK to open the comments section
    // Example: await SdkService.rpc('getcomments', [videoId])
  }
  catch (error) {
    console.error('Error fetching comments:', error)
  }
}

async function handleShare(videoId: string) {
  try {
    console.log('Share video:', videoId)
    // Use the Bastyon SDK to share the video
    // Example: await SdkService.rpc('share', [videoId])
  }
  catch (error) {
    console.error('Error sharing video:', error)
  }
}

async function handleFollow(authorAddress: string) {
  try {
    console.log('Follow author:', authorAddress)
    // Use the Bastyon SDK to follow the author
    // Example: await SdkService.rpc('follow', [authorAddress])
  }
  catch (error) {
    console.error('Error following author:', error)
  }
}

onMounted(() => {
  initVideoFeed()

  // Add event listeners
  window.addEventListener('touchstart', handleTouchStart)
  window.addEventListener('touchend', handleTouchEnd)
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
      <div class="absolute left-4 top-4 text-white font-bold">
        {{ currentVideoIndex + 1 }} / {{ videos.length }}
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
