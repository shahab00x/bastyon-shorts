<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

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

const props = defineProps<{
  video: Video
  isActive: boolean
}>()

const emit = defineEmits(['like', 'comment', 'share', 'follow'])

const videoRef = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const showDescription = ref(false)
const showComments = ref(false)
const rating = ref(1)
const isRatingExpanded = ref(false)
const isFollowed = ref(false)

// Video controls
function togglePlay() {
  if (!videoRef.value)
    return

  if (isPlaying.value)
    videoRef.value.pause()
  else
    videoRef.value.play().catch(err => console.error('Error playing video:', err))

  isPlaying.value = !isPlaying.value
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

// Rating system
function expandRating() {
  isRatingExpanded.value = true
}

function setRating(value: number) {
  rating.value = value
  isRatingExpanded.value = false
}

// Description drawer
function toggleDescription() {
  showDescription.value = !showDescription.value
}

// Comments drawer
// Comments drawer
async function toggleComments() {
  showComments.value = !showComments.value
  if (showComments.value) {
    try {
      // In a real implementation, you would fetch comments using the Bastyon SDK
      // For now, we're just logging the action
      console.log('Fetching comments for video:', props.video.id)
      // Example of how you might use the SDK:
      // const result = await SdkService.rpc('getcomments', [props.video.id])
    }
    catch (error) {
      console.error('Error fetching comments:', error)
    }
  }
  emit('comment', props.video.id)
}

// Share action
async function handleShare() {
  try {
    // In a real implementation, you would use the Bastyon SDK to share the video
    console.log('Shared video:', props.video.id)
    // Example of how you might use the SDK:
    // await SdkService.rpc('share', [props.video.id])
  }
  catch (error) {
    console.error('Error sharing video:', error)
  }
  emit('share', props.video.id)
}

// Follow action
async function toggleFollow() {
  try {
    isFollowed.value = !isFollowed.value
    // In a real implementation, you would use the Bastyon SDK to follow the author
    console.log('Followed author:', props.video.author.address)
    // Example of how you might use the SDK:
    // await SdkService.rpc('follow', [props.video.author.address])
  }
  catch (error) {
    console.error('Error following author:', error)
    // Revert the UI change if the API call fails
    isFollowed.value = !isFollowed.value
  }
  emit('follow', props.video.author.address)
}

// Video events
function onTimeUpdate() {
  if (videoRef.value)
    currentTime.value = videoRef.value.currentTime
}

function onVideoEnd() {
  // Emit event to go to next video
  // This will be handled by the parent component
}

// Watch for active state changes
watch(() => props.isActive, (newVal) => {
  if (videoRef.value) {
    if (newVal) {
      videoRef.value.play().catch(err => console.error('Error playing video:', err))
      isPlaying.value = true
    }
    else {
      videoRef.value.pause()
      isPlaying.value = false
    }
  }
})

onMounted(() => {
  if (props.isActive && videoRef.value) {
    videoRef.value.play().catch(err => console.error('Error playing video:', err))
    isPlaying.value = true
  }
})

onUnmounted(() => {
  if (videoRef.value) {
    videoRef.value.pause()
    isPlaying.value = false
  }
})
</script>

<template>
  <div class="video-player relative h-full w-full bg-black">
    <!-- Video element -->
    <video
      ref="videoRef"
      :src="video.url"
      class="h-full w-full object-cover"
      playsinline
      @timeupdate="onTimeUpdate"
      @ended="onVideoEnd"
      @click="togglePlay"
    />

    <!-- Play/Pause overlay -->
    <div
      v-if="!isPlaying && isActive"
      class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30"
      @click="togglePlay"
    >
      <div class="i-carbon-play-filled text-6xl text-white" />
    </div>

    <!-- Top gradient overlay -->
    <div class="absolute left-0 right-0 top-0 h-1/3 from-black to-transparent bg-gradient-to-b" />

    <!-- Bottom section -->
    <div class="absolute bottom-0 left-0 right-0 from-black to-transparent bg-gradient-to-t p-4">
      <!-- Author info -->
      <div class="mb-2 flex items-center justify-between">
        <div class="flex items-center">
          <span class="text-lg text-white font-bold">@{{ video.author.name }}</span>
          <button
            class="ml-3 rounded-full px-3 py-1 text-sm font-bold" :class="[
              isFollowed ? 'bg-gray-600 text-white' : 'bg-white text-black',
            ]"
            @click="toggleFollow"
          >
            {{ isFollowed ? 'Following' : 'Follow' }}
          </button>
        </div>
      </div>

      <!-- Video description -->
      <div
        class="mb-2 cursor-pointer text-sm text-white"
        @click="toggleDescription"
      >
        {{ video.description }}
      </div>

      <!-- Video stats -->
      <div class="flex items-center text-sm text-white">
        <span>{{ formatTime(video.duration) }}</span>
      </div>
    </div>

    <!-- Right side panel -->
    <div class="absolute bottom-24 right-4 flex flex-col items-center space-y-6">
      <!-- Rating system -->
      <div class="flex flex-col items-center">
        <div
          v-if="!isRatingExpanded"
          class="flex flex-col cursor-pointer items-center"
          @click="expandRating"
        >
          <div class="i-carbon-star-filled text-2xl text-yellow-400" />
          <span class="mt-1 text-xs text-white">{{ rating }}</span>
        </div>

        <div v-else class="flex flex-col items-center">
          <div class="mb-2 flex space-x-1">
            <div
              v-for="i in 5"
              :key="i"
              class="i-carbon-star cursor-pointer text-2xl" :class="[
                i <= rating ? 'text-yellow-400' : 'text-white',
              ]"
              @click="setRating(i)"
            />
          </div>
          <span class="text-xs text-white">Tap to rate</span>
        </div>
      </div>

      <!-- Comments -->
      <div
        class="flex flex-col cursor-pointer items-center"
        @click="toggleComments"
      >
        <div class="i-carbon-chat text-2xl text-white" />
        <span class="mt-1 text-xs text-white">{{ video.comments }}</span>
      </div>

      <!-- Share -->
      <div
        class="flex flex-col cursor-pointer items-center"
        @click="handleShare"
      >
        <div class="i-carbon-share text-2xl text-white" />
        <span class="mt-1 text-xs text-white">Share</span>
      </div>
    </div>

    <!-- Description drawer -->
    <div
      v-if="showDescription"
      class="absolute inset-0 z-10 flex flex-col bg-black bg-opacity-80"
      @click="toggleDescription"
    >
      <div class="flex items-center justify-between border-b border-gray-700 p-4">
        <span class="text-white font-bold">Description</span>
        <div class="i-carbon-close text-2xl text-white" />
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <p class="text-white">
          {{ video.description }}
        </p>
      </div>
    </div>

    <!-- Comments drawer -->
    <div
      v-if="showComments"
      class="absolute bottom-0 right-0 top-0 z-10 w-2/3 flex flex-col bg-gray-900"
      @click="toggleComments"
    >
      <div class="flex items-center justify-between border-b border-gray-700 p-4">
        <span class="text-white font-bold">Comments ({{ video.comments }})</span>
        <div class="i-carbon-close text-2xl text-white" />
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Comments will be loaded here -->
        <div class="py-8 text-center text-gray-400">
          Loading comments...
        </div>
      </div>
      <div class="border-t border-gray-700 p-4">
        <div class="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Add a comment..."
            class="flex-1 rounded-full bg-gray-800 px-4 py-2 text-white"
          >
          <button class="rounded-full bg-blue-600 px-4 py-2 text-sm text-white">
            Post
          </button>
        </div>
        <div class="mt-2 flex items-center text-sm text-gray-400">
          <span>Tip the creator:</span>
          <button class="ml-2 rounded-full bg-yellow-600 px-3 py-1 text-xs text-white">
            10 PKOIN
          </button>
          <button class="ml-2 rounded-full bg-yellow-600 px-3 py-1 text-xs text-white">
            50 PKOIN
          </button>
          <button class="ml-2 rounded-full bg-yellow-600 px-3 py-1 text-xs text-white">
            100 PKOIN
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-player {
  touch-action: manipulation;
}
</style>
