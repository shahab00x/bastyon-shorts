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
const userHasInteracted = ref(false)
const showPlayButton = ref(true)

// Video controls
async function togglePlay() {
  if (!videoRef.value)
    return

  try {
    if (isPlaying.value) {
      videoRef.value.pause()
      isPlaying.value = false
      showPlayButton.value = true
    }
    else {
      // Mark that user has interacted
      userHasInteracted.value = true
      await videoRef.value.play()
      isPlaying.value = true
      showPlayButton.value = false
    }
  }
  catch (err) {
    console.error('Error toggling video playback:', err)
    // If autoplay fails, show the play button
    showPlayButton.value = true
    isPlaying.value = false
  }
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
  // Emit like event with rating
  emit('like', props.video.id)
}

// Description drawer
function toggleDescription() {
  showDescription.value = !showDescription.value
}

// Comments drawer
async function toggleComments() {
  showComments.value = !showComments.value
  if (showComments.value)
    emit('comment', props.video.id)
}

// Share action
async function handleShare() {
  emit('share', props.video.id)
}

// Follow action
async function toggleFollow() {
  isFollowed.value = !isFollowed.value
  emit('follow', props.video.author.address)
}

// Video events
function onTimeUpdate() {
  if (videoRef.value)
    currentTime.value = videoRef.value.currentTime
}

function onVideoEnd() {
  isPlaying.value = false
  showPlayButton.value = true
  // Reset video to beginning
  if (videoRef.value)
    videoRef.value.currentTime = 0
}

function onVideoLoadedMetadata() {
  if (videoRef.value) {
    // Video is loaded and ready
    console.log('Video loaded:', props.video.title)
  }
}

function onVideoError(event: Event) {
  console.error('Video error:', event)
  const video = event.target as HTMLVideoElement
  if (video.error)
    console.error('Video error details:', video.error.message, video.error.code)
}

// Watch for active state changes
watch(() => props.isActive, async (newVal) => {
  if (!videoRef.value)
    return

  if (newVal) {
    // Only auto-play if user has interacted before
    if (userHasInteracted.value) {
      try {
        await videoRef.value.play()
        isPlaying.value = true
        showPlayButton.value = false
      }
      catch (err) {
        console.warn('Autoplay prevented:', err)
        showPlayButton.value = true
        isPlaying.value = false
      }
    }
    else {
      // Show play button for first interaction
      showPlayButton.value = true
      isPlaying.value = false
    }
  }
  else {
    // Pause when not active
    videoRef.value.pause()
    isPlaying.value = false
  }
})

// Handle video click
function handleVideoClick() {
  togglePlay()
}

onMounted(() => {
  if (videoRef.value) {
    // Set up video element
    videoRef.value.muted = true // Start muted to allow autoplay
    videoRef.value.playsInline = true
    videoRef.value.preload = 'metadata'

    // For the first video, show play button
    if (props.isActive)
      showPlayButton.value = true
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
      class="h-full w-full cursor-pointer object-cover"

      muted playsinline
      preload="metadata"
      @timeupdate="onTimeUpdate"
      @ended="onVideoEnd"
      @loadedmetadata="onVideoLoadedMetadata"
      @error="onVideoError"
      @click="handleVideoClick"
    />

    <!-- Play/Pause overlay -->
    <div
      v-if="showPlayButton || (!isPlaying && isActive)"
      class="absolute inset-0 flex cursor-pointer items-center justify-center bg-black bg-opacity-30"
      @click="handleVideoClick"
    >
      <div class="i-carbon-play-filled text-6xl text-white drop-shadow-lg" />
      <div v-if="!userHasInteracted" class="absolute bottom-20 left-1/2 transform rounded bg-black bg-opacity-60 px-3 py-1 text-sm text-white -translate-x-1/2">
        Tap to play
      </div>
    </div>

    <!-- Loading indicator -->
    <div
      v-if="isActive && !videoRef?.readyState"
      class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div class="i-carbon-renew animate-spin text-4xl text-white" />
    </div>

    <!-- Top gradient overlay -->
    <div class="pointer-events-none absolute left-0 right-0 top-0 h-1/3 from-black to-transparent bg-gradient-to-b" />

    <!-- Bottom section -->
    <div class="pointer-events-none absolute bottom-0 left-0 right-0 from-black to-transparent bg-gradient-to-t p-4">
      <!-- Author info -->
      <div class="pointer-events-auto mb-2 flex items-center justify-between">
        <div class="flex items-center">
          <span class="text-lg text-white font-bold">@{{ video.author.name }}</span>
          <button
            class="ml-3 rounded-full px-3 py-1 text-sm font-bold transition-colors"
            :class="[
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
        class="pointer-events-auto line-clamp-2 mb-2 cursor-pointer text-sm text-white"
        @click="toggleDescription"
      >
        {{ video.description }}
      </div>

      <!-- Video stats -->
      <div class="pointer-events-auto flex items-center text-sm text-white">
        <span>{{ formatTime(video.duration) }}</span>
        <span class="ml-4">{{ video.likes }} likes</span>
        <span class="ml-4">{{ video.comments }} comments</span>
      </div>

      <!-- Video progress bar -->
      <div v-if="isPlaying || currentTime > 0" class="pointer-events-auto mt-2 h-1 w-full rounded-full bg-gray-600">
        <div
          class="h-1 rounded-full bg-white transition-all duration-100"
          :style="{ width: `${(currentTime / video.duration) * 100}%` }"
        />
      </div>
    </div>

    <!-- Right side panel -->
    <div class="absolute bottom-24 right-4 flex flex-col items-center space-y-6">
      <!-- Rating system -->
      <div class="flex flex-col items-center">
        <div
          v-if="!isRatingExpanded"
          class="flex flex-col cursor-pointer items-center rounded-full bg-black bg-opacity-40 p-2"
          @click="expandRating"
        >
          <div class="i-carbon-star-filled text-2xl text-yellow-400" />
          <span class="mt-1 text-xs text-white">{{ rating }}</span>
        </div>

        <div v-else class="flex flex-col items-center rounded-lg bg-black bg-opacity-60 p-2">
          <div class="mb-2 flex space-x-1">
            <div
              v-for="i in 5"
              :key="i"
              class="cursor-pointer text-xl transition-colors"
              :class="[
                i <= rating ? 'i-carbon-star-filled text-yellow-400' : 'i-carbon-star text-white',
              ]"
              @click="setRating(i)"
            />
          </div>
          <span class="text-center text-xs text-white">Tap to rate</span>
        </div>
      </div>

      <!-- Comments -->
      <div
        class="flex flex-col cursor-pointer items-center rounded-full bg-black bg-opacity-40 p-2"
        @click="toggleComments"
      >
        <div class="i-carbon-chat text-2xl text-white" />
        <span class="mt-1 text-xs text-white">{{ video.comments }}</span>
      </div>

      <!-- Share -->
      <div
        class="flex flex-col cursor-pointer items-center rounded-full bg-black bg-opacity-40 p-2"
        @click="handleShare"
      >
        <div class="i-carbon-share text-2xl text-white" />
        <span class="mt-1 text-xs text-white">Share</span>
      </div>
    </div>

    <!-- Description drawer -->
    <div
      v-if="showDescription"
      class="absolute inset-0 z-10 flex flex-col bg-black bg-opacity-90"
      @click="toggleDescription"
    >
      <div class="flex items-center justify-between border-b border-gray-700 p-4">
        <span class="text-white font-bold">Description</span>
        <div class="i-carbon-close cursor-pointer text-2xl text-white" />
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <h3 class="mb-2 text-lg text-white font-bold">
          {{ video.title }}
        </h3>
        <p class="mb-4 text-white">
          {{ video.description }}
        </p>
        <div class="text-sm text-gray-400">
          <p>By @{{ video.author.name }}</p>
          <p>{{ new Date(video.timestamp).toLocaleDateString() }}</p>
          <p>{{ video.likes }} likes • {{ video.comments }} comments</p>
        </div>
      </div>
    </div>

    <!-- Comments drawer -->
    <div
      v-if="showComments"
      class="absolute bottom-0 right-0 top-0 z-10 w-2/3 flex flex-col bg-gray-900"
      @click.stop
    >
      <div class="flex items-center justify-between border-b border-gray-700 p-4">
        <span class="text-white font-bold">Comments ({{ video.comments }})</span>
        <div class="i-carbon-close cursor-pointer text-2xl text-white" @click="toggleComments" />
      </div>
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Sample comments - in real app, these would come from the API -->
        <div class="space-y-4">
          <div class="flex space-x-3">
            <div class="h-8 w-8 flex items-center justify-center rounded-full bg-gray-600">
              <span class="text-xs text-white">U</span>
            </div>
            <div class="flex-1">
              <div class="flex items-center space-x-2">
                <span class="text-sm text-white font-semibold">user123</span>
                <span class="text-xs text-gray-400">2h ago</span>
              </div>
              <p class="mt-1 text-sm text-white">
                Great video! Love the content 🔥
              </p>
            </div>
          </div>

          <div class="flex space-x-3">
            <div class="h-8 w-8 flex items-center justify-center rounded-full bg-gray-600">
              <span class="text-xs text-white">C</span>
            </div>
            <div class="flex-1">
              <div class="flex items-center space-x-2">
                <span class="text-sm text-white font-semibold">creator_fan</span>
                <span class="text-xs text-gray-400">1h ago</span>
              </div>
              <p class="mt-1 text-sm text-white">
                Amazing work! Keep it up!
              </p>
            </div>
          </div>
        </div>

        <!-- Loading comments message -->
        <div class="py-8 text-center text-gray-400">
          <div class="i-carbon-renew mb-2 animate-spin text-2xl" />
          <p>Loading more comments...</p>
        </div>
      </div>

      <!-- Comment input -->
      <div class="border-t border-gray-700 p-4">
        <div class="mb-3 flex items-center space-x-2">
          <input
            type="text"
            placeholder="Add a comment..."
            class="flex-1 border border-gray-600 rounded-full bg-gray-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none placeholder-gray-400"
          >
          <button class="rounded-full bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700">
            Post
          </button>
        </div>

        <!-- Tip buttons -->
        <div class="flex items-center text-sm text-gray-400">
          <span>Tip the creator:</span>
          <button class="ml-2 rounded-full bg-yellow-600 px-3 py-1 text-xs text-white transition-colors hover:bg-yellow-700">
            10 PKOIN
          </button>
          <button class="ml-2 rounded-full bg-yellow-600 px-3 py-1 text-xs text-white transition-colors hover:bg-yellow-700">
            50 PKOIN
          </button>
          <button class="ml-2 rounded-full bg-yellow-600 px-3 py-1 text-xs text-white transition-colors hover:bg-yellow-700">
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

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
