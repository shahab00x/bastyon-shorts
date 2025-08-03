<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { SdkService } from '~/composables/sdkService'

const emit = defineEmits(['close'])

const videoStream = ref<MediaStream | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const isRecording = ref(false)
const recordedVideo = ref<string | null>(null)
const recordingTime = ref(0)
const timerInterval = ref<number | null>(null)
const error = ref<string | null>(null)
const isUploading = ref(false)

let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []

// Initialize camera
async function initCamera() {
  try {
    // Request camera permission
    await SdkService.checkAndRequestPermissions(['camera'])

    // Get user media
    videoStream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: true,
    })

    if (videoRef.value)
      videoRef.value.srcObject = videoStream.value
  }
  catch (err) {
    console.error('Error accessing camera:', err)
    error.value = 'Failed to access camera. Please check permissions.'
  }
}

// Start recording
async function startRecording() {
  if (!videoStream.value)
    return

  try {
    recordedChunks = []
    mediaRecorder = new MediaRecorder(videoStream.value)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0)
        recordedChunks.push(event.data)
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' })
      recordedVideo.value = URL.createObjectURL(blob)
    }

    mediaRecorder.start()
    isRecording.value = true
    recordingTime.value = 0

    // Start timer
    timerInterval.value = window.setInterval(() => {
      recordingTime.value++
    }, 1000)
  }
  catch (err) {
    console.error('Error starting recording:', err)
    error.value = 'Failed to start recording.'
  }
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop()
    isRecording.value = false

    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
  }
}

// Format recording time
function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Upload video
async function uploadVideo() {
  if (!recordedVideo.value)
    return

  isUploading.value = true

  try {
    // Use the Bastyon SDK to upload the video
    // Note: This is a simplified implementation - in a real app, you would need to properly
    // handle the video data and add metadata like hashtags
    console.log('Uploading video with #bshorts hashtag')

    // Example of how you might use the SDK:
    // const result = await SdkService.rpc('upload', [{
    //   videoData: recordedVideo.value,
    //   hashtags: ['#bshorts'],
    //   description: 'Uploaded via BShorts app'
    // }])

    // For now, we'll simulate the upload process
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Close camera interface after successful upload
    emit('close')
  }
  catch (err) {
    console.error('Error uploading video:', err)
    error.value = 'Failed to upload video. Please try again.'
  }
  finally {
    isUploading.value = false
  }
}

// Discard recording
function discardRecording() {
  if (recordedVideo.value) {
    URL.revokeObjectURL(recordedVideo.value)
    recordedVideo.value = null
  }
  recordedChunks = []
}

// Select video from gallery
async function selectFromGallery() {
  try {
    // Request gallery permission
    await SdkService.checkAndRequestPermissions(['gallery'])

    // In a real implementation, this would use the Bastyon SDK to select a video from gallery
    // For now, we'll simulate the selection
    error.value = 'Gallery selection not implemented in this demo.'
  }
  catch (err) {
    console.error('Error accessing gallery:', err)
    error.value = 'Failed to access gallery.'
  }
}

onMounted(() => {
  initCamera()
})

onUnmounted(() => {
  // Stop camera stream
  if (videoStream.value)
    videoStream.value.getTracks().forEach(track => track.stop())

  // Clear timer
  if (timerInterval.value)
    clearInterval(timerInterval.value)

  // Revoke object URLs
  if (recordedVideo.value)
    URL.revokeObjectURL(recordedVideo.value)
})
</script>

<template>
  <div class="camera-interface fixed inset-0 z-50 flex flex-col bg-black">
    <!-- Header -->
    <div class="flex items-center justify-between p-4">
      <button
        class="text-2xl text-white"
        @click="emit('close')"
      >
        <div class="i-carbon-close" />
      </button>
      <h1 class="text-lg text-white font-bold">
        Record Video
      </h1>
      <div class="w-6" /> <!-- Spacer -->
    </div>

    <!-- Camera viewfinder -->
    <div class="relative flex-1 overflow-hidden">
      <!-- Camera stream -->
      <video
        v-show="!recordedVideo && !error"
        ref="videoRef"
        class="h-full w-full object-cover"

        autoplay muted playsinline
      />

      <!-- Recorded video preview -->
      <video
        v-show="recordedVideo"
        :src="recordedVideo"
        class="h-full w-full object-cover"
        playsinline
        controls
      />

      <!-- Error message -->
      <div
        v-if="error"
        class="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"
      >
        <div class="i-carbon-error mb-4 text-4xl text-red-500" />
        <p class="mb-4 text-lg text-white">
          {{ error }}
        </p>
        <button
          class="rounded-full bg-blue-600 px-6 py-2 text-white"
          @click="initCamera"
        >
          Try Again
        </button>
      </div>

      <!-- Recording indicator -->
      <div
        v-if="isRecording"
        class="absolute left-4 top-4 flex items-center rounded-full bg-red-600 bg-opacity-80 px-3 py-1"
      >
        <div class="mr-2 h-3 w-3 animate-pulse rounded-full bg-white" />
        <span class="text-sm text-white font-bold">REC</span>
        <span class="ml-2 text-sm text-white">{{ formatTime(recordingTime) }}</span>
      </div>

      <!-- Recording time overlay -->
      <div
        v-if="isRecording"
        class="absolute left-1/2 top-1/2 h-20 w-20 flex transform items-center justify-center rounded-full bg-black bg-opacity-50 text-4xl text-white font-bold -translate-x-1/2 -translate-y-1/2"
      >
        {{ formatTime(recordingTime) }}
      </div>
    </div>

    <!-- Controls -->
    <div class="p-4">
      <!-- Recording controls -->
      <div v-if="!recordedVideo" class="mb-4 flex items-center justify-center space-x-8">
        <button
          v-if="!isRecording"
          class="h-16 w-16 flex items-center justify-center border-4 border-white rounded-full"
          @click="startRecording"
        >
          <div class="h-10 w-10 rounded-full bg-white" />
        </button>

        <button
          v-else
          class="h-16 w-16 flex items-center justify-center border-4 border-white rounded-full"
          @click="stopRecording"
        >
          <div class="h-8 w-8 bg-white" />
        </button>

        <button
          class="text-2xl text-white"
          @click="selectFromGallery"
        >
          <div class="i-carbon-folder" />
        </button>
      </div>

      <!-- Preview controls -->
      <div v-else class="flex justify-center space-x-8">
        <button
          class="h-14 w-14 flex items-center justify-center border-2 border-white rounded-full text-white"
          @click="discardRecording"
        >
          <div class="i-carbon-trash-can" />
        </button>

        <button
          :disabled="isUploading"
          class="h-14 w-14 flex items-center justify-center rounded-full bg-blue-600 text-white"
          @click="uploadVideo"
        >
          <div v-if="isUploading" class="i-carbon-renew animate-spin" />
          <div v-else class="i-carbon-upload" />
        </button>
      </div>

      <!-- Upload instructions -->
      <div class="mt-4 text-center text-sm text-gray-400">
        <p>By uploading, you agree to our Terms of Service</p>
        <p>Add #bshorts hashtag for better discoverability</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.camera-interface {
  touch-action: manipulation;
}
</style>
