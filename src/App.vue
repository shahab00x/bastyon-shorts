<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { SdkService } from '~/composables/sdkService'
import VideoFeed from '~/components/VideoFeed.vue'
import CameraInterface from '~/components/CameraInterface.vue'

const showCamera = ref(false)
const isInitialized = ref(false)
const initError = ref<string | null>(null)

// Initialize the app
async function initApp() {
  try {
    await SdkService.init()
    isInitialized.value = true
  }
  catch (err) {
    console.error('Error initializing app:', err)
    initError.value = 'Failed to initialize the application. Please try again.'
  }
}

// Handle left swipe to open camera
let startX = 0

function handleTouchStart(e: TouchEvent) {
  startX = e.touches[0].clientX
}

function handleTouchEnd(e: TouchEvent) {
  const endX = e.changedTouches[0].clientX
  const diffX = endX - startX
  const swipeThreshold = 50

  // Swipe left - open camera
  if (diffX < -swipeThreshold)
    showCamera.value = true
}

// Close camera interface
function closeCamera() {
  showCamera.value = false
}

onMounted(() => {
  initApp()

  // Add swipe gesture listener
  window.addEventListener('touchstart', handleTouchStart)
  window.addEventListener('touchend', handleTouchEnd)
})
</script>

<template>
  <div class="app h-screen w-screen overflow-hidden bg-black text-white">
    <!-- Initialization loading -->
    <div v-if="!isInitialized && !initError" class="h-full flex items-center justify-center">
      <div class="text-center">
        <div class="i-carbon-renew mb-4 animate-spin text-4xl" />
        <p class="text-lg">
          Initializing BShorts...
        </p>
      </div>
    </div>

    <!-- Initialization error -->
    <div v-else-if="initError" class="h-full flex flex-col items-center justify-center p-4">
      <div class="i-carbon-error mb-4 text-4xl text-red-500" />
      <p class="mb-4 text-center">
        {{ initError }}
      </p>
      <button
        class="rounded-full bg-blue-600 px-6 py-2 text-white"
        @click="initApp"
      >
        Try Again
      </button>
    </div>

    <!-- Main app content -->
    <div v-else class="relative h-full">
      <!-- Video feed -->
      <VideoFeed />

      <!-- Camera button -->
      <button
        class="absolute bottom-8 left-4 h-14 w-14 flex items-center justify-center rounded-full bg-white bg-opacity-20 text-2xl text-white"
        @click="showCamera = true"
      >
        <div class="i-carbon-video" />
      </button>

      <!-- Camera interface -->
      <CameraInterface
        v-if="showCamera"
        @close="closeCamera"
      />
    </div>
  </div>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
    Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

.app {
  touch-action: pan-y;
}
</style>
