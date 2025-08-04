<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import VideoPlayer from './VideoPlayer.vue'

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
    // Use our backend API service instead of direct SDK calls
    let apiVideos = []

    try {
      // Test if basic API calls work
      const nodeInfo = await ApiService.getNodeInfo()
      console.log('Node info:', nodeInfo)

      // Try the search method with correct parameters based on documentation
      try {
        const result = await ApiService.search('#bshorts', 'content', 0, 50)

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
          const simpleResult = await ApiService.search('#bshorts')

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
          // Fallback to mock data if both search methods fail
          apiVideos = [
            {
              id: '1',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
              thumbnail: 'https://peach.blender.org/wp-content/uploads/bbb-splash.png',
              title: 'Big Buck Bunny',
              description: 'A large and lovable rabbit deals with three tiny bullies.',
              author: {
                name: 'Blender Foundation',
                address: 'blender-foundation',
              },
              duration: 596,
              likes: 1200,
              comments: 42,
              timestamp: Date.now() - 86400000, // 1 day ago
            },
            {
              id: '2',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
              thumbnail: 'https://peach.blender.org/wp-content/uploads/ed-splash.png',
              title: 'Elephants Dream',
              description: 'The story of two strange characters exploring a capricious and seemingly infinite machine.',
              author: {
                name: 'Blender Foundation',
                address: 'blender-foundation',
              },
              duration: 653,
              likes: 950,
              comments: 38,
              timestamp: Date.now() - 172800000, // 2 days ago
            },
            {
              id: '3',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
              thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
              title: 'For Bigger Blazes',
              description: 'A movie trailer featuring a giant monster robot.',
              author: {
                name: 'Google',
                address: 'google-sample',
              },
              duration: 15,
              likes: 520,
              comments: 15,
              timestamp: Date.now() - 259200000, // 3 days ago
            },
          ]
        }
      }
    }
    catch (nodeError) {
      console.warn('Node info failed:', nodeError)
      // Continue with search even if node info fails
    }

    // Transform API videos to our Video interface
    const transformedVideos = apiVideos.map((video: any) => ({
      id: video.id || video.txid || Math.random().toString(36).substr(2, 9),
      url: video.url || video.videoUrl || '',
      thumbnail: video.thumbnail || video.previewUrl || '',
      title: video.title || 'Untitled Video',
      description: video.description || '',
      author: {
        name: video.author?.name || video.username || 'Unknown Author',
        address: video.author?.address || video.userAddress || '',
      },
      duration: video.duration || 0,
      likes: video.likes || video.likeCount || 0,
      comments: video.comments || video.commentCount || 0,
      timestamp: video.timestamp || video.created || Date.now(),
    }))

    // If we don't have any API videos, use mock data
    if (transformedVideos.length === 0) {
      const mockVideos: Video[] = [
        {
          id: '1',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          thumbnail: 'https://peach.blender.org/wp-content/uploads/bbb-splash.png',
          title: 'Big Buck Bunny',
          description: 'A large and lovable rabbit deals with three tiny bullies.',
          author: {
            name: 'Blender Foundation',
            address: 'blender-foundation',
          },
          duration: 596,
          likes: 1200,
          comments: 42,
          timestamp: Date.now() - 86400000, // 1 day ago
        },
        {
          id: '2',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
          thumbnail: 'https://peach.blender.org/wp-content/uploads/ed-splash.png',
          title: 'Elephants Dream',
          description: 'The story of two strange characters exploring a capricious and seemingly infinite machine.',
          author: {
            name: 'Blender Foundation',
            address: 'blender-foundation',
          },
          duration: 653,
          likes: 950,
          comments: 38,
          timestamp: Date.now() - 172800000, // 2 days ago
        },
        {
          id: '3',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnail: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
          title: 'For Bigger Blazes',
          description: 'A movie trailer featuring a giant monster robot.',
          author: {
            name: 'Google',
            address: 'google-sample',
          },
          duration: 15,
          likes: 520,
          comments: 15,
          timestamp: Date.now() - 259200000, // 3 days ago
        },
      ]

      videos.value = mockVideos
    }
    else {
      videos.value = transformedVideos
    }
  }
  catch (err) {
    console.error('Error fetching videos:', err)
    error.value = 'Failed to load videos. Please try again later.'
  }
  finally {
    isLoading.value = false
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
  const diff = startY - endY
  const minSwipeDistance = 50

  if (Math.abs(diff) > minSwipeDistance) {
    if (diff > 0) {
      // Swipe up - next video
      if (currentVideoIndex.value < videos.value.length - 1)
        currentVideoIndex.value++
    }
    else {
      // Swipe down - previous video
      if (currentVideoIndex.value > 0)
        currentVideoIndex.value--
    }
  }
}

// Keyboard navigation for testing
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') {
    if (currentVideoIndex.value > 0)
      currentVideoIndex.value--
  }
  else if (e.key === 'ArrowDown') {
    if (currentVideoIndex.value < videos.value.length - 1)
      currentVideoIndex.value++
  }
}

// Video player events
function handleLike(videoId: string) {
  console.log('Like video:', videoId)
  // In a real app, you would send this to your backend
  const video = videos.value.find(v => v.id === videoId)
  if (video)
    video.likes++
}

function handleComment(videoId: string) {
  console.log('Comment on video:', videoId)
  // In a real app, you would open a comment modal or navigate to comments
}

function handleShare(videoId: string) {
  console.log('Share video:', videoId)
  // In a real app, you would open a share dialog
}

function handleFollow(authorAddress: string) {
  console.log('Follow author:', authorAddress)
  // In a real app, you would send this to your backend
}

onMounted(() => {
  initVideoFeed()

  // Add event listeners
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('touchstart', handleTouchStart)
  window.addEventListener('touchend', handleTouchEnd)
})

onBeforeUnmount(() => {
  // Clean up event listeners
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchend', handleTouchEnd)
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
      <VideoPlayer
        :video="videos[currentVideoIndex]"
        :is-active="true"
        @like="handleLike"
        @comment="handleComment"
        @share="handleShare"
        @follow="handleFollow"
      />

      <!-- Video indicators -->
      <div class="absolute right-4 top-1/2 flex flex-col gap-2 -translate-y-1/2">
        <div
          v-for="(video, index) in videos"
          :key="video.id"
          class="h-1.5 w-1.5 rounded-full bg-white bg-opacity-50 transition-all duration-300"
          :class="{ 'bg-white bg-opacity-100 scale-125': index === currentVideoIndex }"
        />
      </div>
    </div>

    <!-- No videos state -->
    <div v-else class="h-full flex flex-col items-center justify-center p-4">
      <div class="i-carbon-video-off mb-4 text-4xl text-gray-500" />
      <p class="text-center text-white">
        No videos found. Try a different hashtag.
      </p>
    </div>
  </div>
</template>

<style scoped>
.video-feed {
  touch-action: pan-y;
}
</style>
