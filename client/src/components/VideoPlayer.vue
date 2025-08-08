<template>
  <div class="video-player-container">
    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>Loading videos...</p>
    </div>
    
    <!-- Error message -->
    <div v-if="error" class="error-overlay">
      <p>{{ error }}</p>
      <button @click="fetchVideos" class="retry-btn">Retry</button>
    </div>
    
    <div 
      class="video-swiper" 
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchCancel"
    >
      <div 
        v-for="(video, index) in playlist" 
        :key="video.id" 
        class="video-slide"
        :class="{ 'active': currentIndex === index }"
      >
        <video 
          ref="videoElements"
          :src="getVideoSource(video.url)" 
          autoplay 
          :muted="isMuted" 
          playsinline
          webkit-playsinline
          x5-playsinline
          preload="metadata"
          @loadeddata="onVideoLoaded(index)"
          @ended="nextVideo"
          @canplay="onVideoCanPlay(index)"
          @play="onVideoPlay(index)"
          @pause="onVideoPause(index)"
        ></video>

        <!-- Unmute hint/control -->
        <button 
          v-if="isMuted" 
          class="unmute-btn" 
          @click.stop="unmuteCurrentVideo(index)"
          aria-label="Unmute"
        >Tap for sound 🔊</button>
        
        <div class="video-info">
          <div class="bottom-section">
            <div class="account-info">
              <span class="account-name">{{ video.uploader }}</span>
              <span class="video-date">{{ video.formattedDate }}</span>
              <button class="follow-btn">Follow</button>
            </div>
            <div 
              class="video-description" 
              @click="toggleDescriptionDrawer"
            >
              <p>{{ truncateDescription(video.description) }}</p>
            </div>
          </div>
          
          <div class="right-panel">
            <div class="settings-btn" @click="toggleSettingsMenu">
              ⚙
            </div>
            <div class="star-rating">
              <div class="stars-container">
                <span 
                  v-for="i in 5" 
                  :key="i" 
                  class="star"
                  :class="{ 'filled': i <= (video.userRating || 1), 'interactive': currentIndex === index }"
                  @click="rateVideo(i, index)"
                >
                  ★
                </span>
              </div>
              <div class="likes-count">{{ video.likes || 0 }} likes</div>
            </div>
            
            <div class="comments-icon" @click="toggleCommentsDrawer">
              💬
              <span class="comments-badge">{{ video.comments || 0 }}</span>
            </div>
            
            <div class="share-btn" @click="shareVideo">
              ↗
            </div>
            
            <div class="download-btn" @click="showDownloadOptions">
              ↓
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Description Drawer -->
    <div 
      class="description-drawer" 
      :class="{ 'open': showDescriptionDrawer }"
      @touchstart="handleDrawerTouchStart"
      @touchmove="handleDrawerTouchMove"
      @touchend="handleDrawerTouchEnd"
    >
      <div class="drawer-content">
        <h3>Video Description</h3>
        <p>{{ currentVideo?.description }}</p>
        <button @click="toggleDescriptionDrawer">Close</button>
      </div>
    </div>
    
    <!-- Comments Drawer -->
    <div 
      class="comments-drawer" 
      :class="{ 'open': showCommentsDrawer }"
      @touchstart="handleDrawerTouchStart"
      @touchmove="handleDrawerTouchMove"
      @touchend="handleDrawerTouchEnd"
    >
      <div class="drawer-content">
        <h3>Comments</h3>
        <div class="comments-list">
          <div 
            v-for="comment in currentVideo?.commentData" 
            :key="comment.id" 
            class="comment"
          >
            <p><strong>{{ comment.user }}:</strong> {{ comment.text }}</p>
            <span class="comment-date">{{ comment.timestamp }}</span>
          </div>
        </div>
        <div class="add-comment">
          <textarea 
            v-model="newComment" 
            placeholder="Add a comment..."
          ></textarea>
          <button @click="addComment">Post</button>
          <button @click="donateToCreator">Donate with PKoin</button>
        </div>
        <button @click="toggleCommentsDrawer">Close</button>
      </div>
    </div>
    
    <!-- Settings Menu -->
    <div 
      v-if="showSettingsMenu" 
      class="settings-menu"
    >
      <div class="settings-content">
        <h3>Settings</h3>
        <div class="settings-option">
          <label for="autoplay">Autoplay Videos</label>
          <input 
            type="checkbox" 
            id="autoplay" 
            v-model="settings.autoplay"
            @change="saveSettings"
          >
        </div>
        <div class="settings-option">
          <label for="darkMode">Dark Mode</label>
          <input 
            type="checkbox" 
            id="darkMode" 
            v-model="settings.darkMode"
            @change="saveSettings"
          >
        </div>
        <div class="settings-option">
          <label for="notifications">Enable Notifications</label>
          <input 
            type="checkbox" 
            id="notifications" 
            v-model="settings.notifications"
            @change="saveSettings"
          >
        </div>
        <button @click="toggleSettingsMenu" class="close-btn">Close</button>
      </div>
    </div>
    
    <!-- Camera Interface -->
    <div 
      v-if="showCameraInterface" 
      class="camera-interface"
    >
      <div class="camera-content">
        <h3>Record a Bastyon Short</h3>
        <div class="camera-preview">
          <div class="camera-placeholder">
            Camera preview would appear here
          </div>
        </div>
        <div class="camera-controls">
          <button @click="closeCameraInterface" class="cancel-btn">Cancel</button>
          <button @click="recordVideo" class="record-btn">Record</button>
          <button @click="uploadVideo" class="upload-btn">Upload</button>
        </div>
      </div>
    <!-- Download Options Modal -->
    <div 
      v-if="showDownloadModal" 
      class="download-modal"
      @click="closeDownloadModal"
    >
      <div class="download-modal-content" @click.stop>
        <h3>Download Video</h3>
        <p>Select a resolution:</p>
        <div class="resolution-options">
          <button 
            v-for="resolution in availableResolutions" 
            :key="resolution.resolution.id"
            @click="downloadVideo(resolution.fileDownloadUrl, resolution.resolution.label)"
            class="resolution-btn"
          >
            {{ resolution.resolution.label }} ({{ formatFileSize(resolution.size) }})
          </button>
        </div>
        <button @click="closeDownloadModal" class="close-btn">Close</button>
      </div>
    </div>
    
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import Hls from 'hls.js'
import bastyonApi from '../services/bastyonApi'

export default defineComponent({
  name: 'VideoPlayer',
  inheritAttrs: false,
  data() {
    return {
      playlist: [],
      currentIndex: 0,
      showDescriptionDrawer: false,
      showCommentsDrawer: false,
      showSettingsMenu: false,
      newComment: '',
      touchStartY: 0,
      touchStartX: 0,
      touchStartTime: 0,
      drawerTouchStartY: 0, // For drawer swipe handling
      isVideoPlaying: false,
      showCameraInterface: false,
      videoCache: new Map(), // Cache for loaded videos
      maxCacheSize: 5, // Maximum number of videos to cache
      settings: {
        autoplay: true,
        darkMode: true,
        notifications: true
      },
      loading: false,
      error: null,
      showDownloadModal: false,
      availableResolutions: []
      ,
      // Keep track of HLS instances per slide index
      hlsPlayers: new Map()
      ,
      // audio state
      isMuted: true,
      userWantsSound: false
    };
  },
  computed: {
    currentVideo() {
      return this.playlist[this.currentIndex]
    }
  },
  methods: {
    // Convert peertube://host/uuid to direct fragmented MP4 for reliable playback
    getVideoSource(url) {
      try {
        if (!url) return '';
        // Decode if encoded
        const decoded = decodeURIComponent(url);
        if (decoded.startsWith('peertube://')) {
          const parts = decoded.substring(11).split('/');
          if (parts.length >= 2) {
            const hostName = parts[0];
            const videoId = parts[1];
            return `https://${hostName}/download/streaming-playlists/hls/videos/${videoId}-360-fragmented.mp4`;
          }
        }
        return decoded;
      } catch (e) {
        // Fallback to original URL on any error
        return url;
      }
    },
    // Setup HLS for a particular video index if supported and hlsUrl is present
    setupHlsForIndex(index) {
      try {
        const video = this.playlist[index];
        if (!video) return;
        const hlsUrl = video?.videoInfo?.peertube?.hlsUrl;
        // If no hlsUrl, skip and rely on direct MP4 source
        if (!hlsUrl) return;

        // If browser supports native HLS (Safari), just set the src directly
        const videoEl = this.$refs.videoElements?.[index] || this.$refs.videoElements;
        if (!videoEl) return;

        // If an instance already exists for this index, do nothing
        if (this.hlsPlayers.has(index)) return;

        if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
          videoEl.src = hlsUrl;
          return;
        }

        if (Hls.isSupported()) {
          const hls = new Hls({
            lowLatencyMode: true,
            backBufferLength: 60,
          });
          hls.loadSource(hlsUrl);
          hls.attachMedia(videoEl);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            console.error('HLS error', data);
          });
          this.hlsPlayers.set(index, hls);
        }
      } catch (e) {
        console.error('Failed to setup HLS:', e);
      }
    },
    // Destroy HLS instance for an index
    destroyHlsForIndex(index) {
      const inst = this.hlsPlayers.get(index);
      if (inst) {
        try { inst.destroy(); } catch (_) {}
        this.hlsPlayers.delete(index);
      }
    },
    // Destroy all HLS instances
    destroyAllHls() {
      for (const [idx, inst] of this.hlsPlayers.entries()) {
        try { inst.destroy(); } catch (_) {}
        this.hlsPlayers.delete(idx);
      }
    },
    // Unmute current video after user gesture and remember preference
    unmuteCurrentVideo(index) {
      this.userWantsSound = true;
      this.isMuted = false;
      this.$nextTick(() => {
        const videoEl = this.$refs.videoElements?.[index] || this.$refs.videoElements;
        if (videoEl) {
          try {
            videoEl.muted = false;
            videoEl.volume = 1.0;
            videoEl.play().catch(() => {});
          } catch (_) {}
        }
      });
    },
    async fetchVideos() {
      // Set loading state
      this.loading = true;
      this.error = null;
      
      try {
        const videos = await bastyonApi.fetchBShorts();
        
        // Filter videos to include only those under 2 minutes (120 seconds)
        this.playlist = videos.filter(video => video.duration < 120)
          .map(video => ({
            ...video,
            userRating: 1 // Default rating
          }));
          
        // Initialize video cache
        this.initializeVideoCache();
      } catch (error) {
        console.error('Error fetching videos:', error);
        this.error = error.message || 'Failed to load videos. Please try again later.';
        
        // Fallback to mock data if API fails
        this.playlist = [
          {
            id: 1,
            url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
            uploader: 'bastyon_user1',
            description: 'This is a sample short video about Bastyon. #bshorts #bastyon',
            userRating: 1,
            comments: [
              { id: 1, user: 'user2', text: 'Great video!' },
              { id: 2, user: 'user3', text: 'Thanks for sharing' }
            ]
          },
          {
            id: 2,
            url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
            uploader: 'bastyon_user2',
            description: 'Another awesome short video on Bastyon platform. #bshorts',
            userRating: 1,
            comments: [
              { id: 1, user: 'user1', text: 'Love this!' }
            ]
          }
        ];
        
        // Initialize video cache
        this.initializeVideoCache();
      } finally {
        // Reset loading state
        this.loading = false;
      }
    },
    nextVideo() {
      if (this.currentIndex < this.playlist.length - 1) {
        this.destroyHlsForIndex(this.currentIndex);
        this.currentIndex++;
        this.preloadAdjacentVideos();
        this.cleanupVideoCache();
        // Setup HLS for new index if available
        this.$nextTick(() => this.setupHlsForIndex(this.currentIndex));
      }
    },
    prevVideo() {
      if (this.currentIndex > 0) {
        this.destroyHlsForIndex(this.currentIndex);
        this.currentIndex--;
        this.preloadAdjacentVideos();
        this.cleanupVideoCache();
        // Setup HLS for new index if available
        this.$nextTick(() => this.setupHlsForIndex(this.currentIndex));
      }
    },
    handleTouchStart(event) {
      this.touchStartY = event.touches[0].clientY;
      this.touchStartX = event.touches[0].clientX;
      this.touchStartTime = Date.now();
    },
    handleTouchMove(event) {
      // Prevent default behavior to avoid page scrolling
      event.preventDefault();
    },
    handleTouchEnd(event) {
      const touchEndY = event.changedTouches[0].clientY;
      const touchEndX = event.changedTouches[0].clientX;
      const diffY = this.touchStartY - touchEndY;
      const diffX = this.touchStartX - touchEndX;
      const touchDuration = Date.now() - this.touchStartTime;
      
      // Only consider swipes that are fast enough (under 300ms) and long enough (over 50px)
      const isFastSwipe = touchDuration < 300;
      const isLongSwipe = Math.abs(diffY) > 50 || Math.abs(diffX) > 50;
      
      if (isFastSwipe && isLongSwipe) {
        // Vertical swipe for video navigation
        if (Math.abs(diffY) > Math.abs(diffX)) {
          // Swipe up for next video
          if (diffY > 50) {
            this.nextVideo();
          }
          // Swipe down for previous video
          else if (diffY < -50) {
            this.prevVideo();
          }
        }
        // Horizontal swipe for camera interface
        else {
          // Swipe left to open camera
          if (diffX > 50) {
            this.openCameraInterface();
          }
        }
      }
    },
    handleTouchCancel() {
      // Reset touch values
      this.touchStartY = 0;
      this.touchStartX = 0;
      this.touchStartTime = 0;
    },
    handleDrawerTouchStart(event) {
      this.drawerTouchStartY = event.touches[0].clientY;
    },
    handleDrawerTouchMove(event) {
      if (!this.drawerTouchStartY) return;
      
      const currentY = event.touches[0].clientY;
      const deltaY = currentY - this.drawerTouchStartY;
      
      // Only close when swiping down
      if (deltaY > 50) { // Minimum swipe distance
        this.showCommentsDrawer = false;
        this.showDescriptionDrawer = false;
        this.drawerTouchStartY = 0;
      }
    },
    handleDrawerTouchEnd() {
      this.drawerTouchStartY = 0;
    },
    initializeVideoCache() {
      // Initialize the video cache with the first few videos
      const preloadCount = Math.min(this.maxCacheSize, this.playlist.length);
      for (let i = 0; i < preloadCount; i++) {
        this.preloadVideo(i);
      }
    },
    // Clean up video cache to prevent memory leaks
    cleanupVideoCache() {
      // Remove videos that are far from the current index
      const cleanupThreshold = this.maxCacheSize + 2;
      
      for (const [index, videoElement] of this.videoCache.entries()) {
        if (Math.abs(index - this.currentIndex) > cleanupThreshold) {
          // Pause the video if it's playing
          if (videoElement && !videoElement.paused) {
            videoElement.pause();
          }
          // Remove from cache
          this.videoCache.delete(index);
        }
      }
    },
    preloadVideo(index) {
      // Preload a video into cache if not already cached
      if (index >= 0 && index < this.playlist.length && !this.videoCache.has(index)) {
        const video = this.playlist[index];
        const videoElement = document.createElement('video');
        videoElement.src = video.url;
        videoElement.preload = 'metadata';
        
        // Add to cache
        this.videoCache.set(index, videoElement);
        
        // Remove oldest entry if cache is full
        if (this.videoCache.size > this.maxCacheSize) {
          const firstKey = this.videoCache.keys().next().value;
          this.videoCache.delete(firstKey);
        }
      }
    },
    preloadAdjacentVideos() {
      // Preload the next and previous videos
      this.preloadVideo(this.currentIndex - 1);
      this.preloadVideo(this.currentIndex + 1);
    },
    openCameraInterface() {
      // Open the camera interface
      this.showCameraInterface = true;
    },
    closeCameraInterface() {
      // Close the camera interface
      this.showCameraInterface = false;
    },
    recordVideo() {
      // In a real implementation, this would start recording
      alert('Recording would start now');
    },
    async uploadVideo() {
      // In a real implementation, this would upload the recorded video
      try {
        const result = await bastyonApi.uploadVideo();
        
        if (result.success) {
          alert('Video uploaded successfully!');
          this.closeCameraInterface();
          // Refresh the playlist to include the new video
          this.fetchVideos();
        }
      } catch (error) {
        console.error('Error uploading video:', error);
        alert('Video upload failed. Please try again.');
      }
    },
    toggleDescriptionDrawer() {
      this.showDescriptionDrawer = !this.showDescriptionDrawer;
    },
    toggleCommentsDrawer() {
      this.showCommentsDrawer = !this.showCommentsDrawer;
    },
    toggleSettingsMenu() {
      this.showSettingsMenu = !this.showSettingsMenu;
    },
    showDownloadOptions() {
      // Show download options modal with available resolutions
      if (this.currentVideo && this.currentVideo.resolutions) {
        this.availableResolutions = this.currentVideo.resolutions;
        this.showDownloadModal = true;
      } else {
        alert('No download options available for this video.');
      }
    },
    closeDownloadModal() {
      // Close the download options modal
      this.showDownloadModal = false;
      this.availableResolutions = [];
    },
    downloadVideo(url, resolution) {
      // Download the video with the selected resolution
      if (url) {
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = `bastyon-short-${this.currentVideo.id}-${resolution}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Close the modal after download starts
        this.closeDownloadModal();
      }
    },
    formatFileSize(bytes) {
      // Format file size for display
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    saveSettings() {
      // In a real implementation, this would save settings to localStorage or a backend
      console.log('Settings saved:', this.settings);
      
      // Save to localStorage
      try {
        localStorage.setItem('bastyonShortsSettings', JSON.stringify(this.settings));
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    },
    async rateVideo(rating, videoIndex) {
      // Only allow rating the current video
      if (videoIndex !== this.currentIndex) return;
      
      const video = this.playlist[videoIndex];
      // In a real implementation, this would come from Bastyon SDK
      const userAddress = 'user_address_placeholder';
      
      try {
        // Update rating on server
        await bastyonApi.rateVideo(video.id, rating, userAddress);
        
        // Update local state
        video.userRating = rating;
        
        // Add animation effect
        this.animateStarRating(videoIndex);
      } catch (error) {
        console.error('Error rating video:', error);
        // Update local state even if server fails
        video.userRating = rating;
        
        // Add animation effect
        this.animateStarRating(videoIndex);
      }
    },
    animateStarRating(videoIndex) {
      // Add animation effect to stars
      const videoElement = this.$refs.videoElements[videoIndex];
      if (videoElement) {
        videoElement.classList.add('rating-animation');
        
        // Remove animation class after animation completes
        setTimeout(() => {
          videoElement.classList.remove('rating-animation');
        }, 1000);
      }
    },
    async shareVideo() {
      if (!this.currentVideo) return;
      
      try {
        // In a real implementation, this would share the video
        // For now, we'll show an alert with share options
        
        if (navigator.share) {
          // Use Web Share API if available
          await navigator.share({
            title: 'Check out this Bastyon Short',
            text: this.currentVideo.description,
            url: window.location.href
          });
        } else {
          // Fallback for browsers that don't support Web Share API
          this.showShareOptions();
        }
      } catch (error) {
        console.error('Error sharing video:', error);
        // Fallback to showing share options
        this.showShareOptions();
      }
    },
    showShareOptions() {
      // Show share options in an alert or modal
      alert(`Share this video:\n${window.location.href}\n\nCopy this link to share the video!`);
    },
    truncateDescription(description) {
      if (!description) return '';
      return description.length > 100 
        ? `${description.substring(0, 100)}...`
        : description;
    },
    async addComment() {
      if (this.newComment.trim() && this.currentVideo) {
        // In a real implementation, this would come from Bastyon SDK
        const userAddress = 'user_address_placeholder';
        
        try {
          const result = await bastyonApi.postComment(
            this.currentVideo.id, 
            this.newComment, 
            userAddress
          );
          
          // Add the comment to the local state
          const comment = {
            id: Date.now(),
            user: 'current_user',
            userAddress: userAddress,
            text: this.newComment,
            timestamp: new Date().toISOString()
          };
          // Ensure commentData exists and is an array
          if (!Array.isArray(this.currentVideo.commentData)) {
            this.currentVideo.commentData = [];
          }
          this.currentVideo.commentData.push(comment);
          // Increment numeric comments count if present
          if (typeof this.currentVideo.comments === 'number') {
            this.currentVideo.comments += 1;
          }
          this.newComment = '';
        } catch (error) {
          console.error('Error posting comment:', error);
          // Fallback to local comment if API fails
          const comment = {
            id: Date.now(),
            user: 'current_user',
            userAddress: userAddress,
            text: this.newComment,
            timestamp: new Date().toISOString()
          };
          if (!Array.isArray(this.currentVideo.commentData)) {
            this.currentVideo.commentData = [];
          }
          this.currentVideo.commentData.push(comment);
          if (typeof this.currentVideo.comments === 'number') {
            this.currentVideo.comments += 1;
          }
          this.newComment = '';
        }
      }
    },
    async donateToCreator() {
      if (this.currentVideo) {
        // In a real implementation, this would come from Bastyon SDK
        const userAddress = 'user_address_placeholder';
        
        try {
          const result = await bastyonApi.donatePKoin(
            this.currentVideo.uploaderAddress, 
            10, // Default donation amount
            userAddress
          );
          
          if (result.success) {
            alert(`Successfully donated to ${this.currentVideo.uploader}!`);
          }
        } catch (error) {
          console.error('Error donating PKoin:', error);
          alert('Donation failed. Please try again.');
        }
      }
    },
    onVideoLoaded(index) {
      // Initialize HLS for this slide if provided by API
      this.setupHlsForIndex(index);
      // existing logic continues...
      console.log(`Video ${index} loaded`);
      
      // Ensure the current video plays when loaded
      if (index === this.currentIndex) {
        this.$nextTick(() => {
          const videoElement = this.$refs.videoElements?.[index];
          if (videoElement) {
            // Honor user's sound preference on subsequent videos
            if (this.userWantsSound) {
              this.isMuted = false;
              videoElement.muted = false;
              videoElement.volume = 1.0;
            }
            videoElement.play().catch(e => console.log('Autoplay failed:', e));
          }
        });
      }
    },
    onVideoCanPlay(index) {
      // Handle video can play event
      console.log(`Video ${index} can play`);
    },
    onVideoPlay(index) {
      // Handle video play event
      if (index === this.currentIndex) {
        this.isVideoPlaying = true;
        console.log(`Video ${index} playing`);
      }
    },
    onVideoPause(index) {
      // Handle video pause event
      if (index === this.currentIndex) {
        this.isVideoPlaying = false;
        console.log(`Video ${index} paused`);
      }
    },
  },
  mounted() {
    this.fetchVideos();
    // Ensure first video initializes HLS if available
    this.$nextTick(() => this.setupHlsForIndex(this.currentIndex));
  },
  beforeUnmount() {
    // Cleanup any HLS instances
    this.destroyAllHls();
    // Clean up video elements to prevent memory leaks
    for (const [index, videoElement] of this.videoCache.entries()) {
      if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement.load();
      }
    }
    this.videoCache.clear();
  }
});

</script>

<style scoped>
.video-player-container {
  position: relative;
  height: 100vh;
  width: 100vw;
  background-color: var(--background-dark);
  overflow: hidden;
}

.video-swiper {
  position: relative;
  height: 100%;
  width: 100%;
}

.video-slide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.video-slide.active {
  opacity: 1;
}

.unmute-btn {
  position: absolute;
  bottom: 90px;
  left: 16px;
  padding: 8px 12px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 20px;
  font-size: 14px;
}

.likes-count {
  margin-top: 6px;
  font-size: 12px;
  color: #ddd;
}

.comments-badge {
  margin-left: 6px;
  background: #e74c3c;
  color: #fff;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 12px;
}

.video-slide video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  top: 0;
  pointer-events: none;
}

.bottom-section {
  position: absolute;
  bottom: 20px;
  left: 15px;
  right: 15px;
  pointer-events: auto;
}

.account-info {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.account-name {
  font-weight: bold;
  margin-right: 10px;
  color: white;
}

.video-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin-right: 10px;
}

.follow-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
}

.follow-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.right-panel {
  position: absolute;
  right: 15px;
  bottom: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
}

.star-rating {
  margin-bottom: 20px;
}

.stars-container {
  cursor: pointer;
}

.star {
  font-size: 24px;
  color: var(--star-empty);
  transition: color 0.2s ease;
  margin: 0 2px;
}

.star.filled {
  color: var(--star-filled);
}

.comments-icon {
  font-size: 24px;
  margin-bottom: 20px;
  cursor: pointer;
  color: var(--text-primary);
}

.share-btn {
  font-size: 24px;
  cursor: pointer;
  color: var(--text-primary);
}

.description-drawer, .comments-drawer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  transform: translateY(100%);
  transition: transform 0.3s ease;
}

.description-drawer.open, .comments-drawer.open {
  transform: translateY(0);
}

.drawer-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--background-darker);
  padding: 20px;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  max-height: 80%;
  overflow-y: auto;
  color: var(--text-primary);
}

.comments-drawer .drawer-content {
  max-height: 66%;
}

.drawer-content h3 {
  margin-top: 0;
  color: var(--text-primary);
}

.add-comment {
  margin: 20px 0;
}

.add-comment textarea {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: none;
  background-color: var(--background-darkest);
  color: var(--text-primary);
  margin-bottom: 10px;
}

.add-comment textarea::placeholder {
  color: var(--text-secondary);
}

.add-comment button {
  background-color: var(--accent-color);
  color: var(--text-primary);
  border: none;
  border-radius: 4px;
  padding: 8px 15px;
  margin-right: 10px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.add-comment button:hover {
  background-color: var(--accent-hover);
}

.drawer-content button {
  background-color: var(--background-darkest);
  color: var(--text-primary);
  border: none;
  border-radius: 4px;
  padding: 8px 15px;
  cursor: pointer;
  margin-top: 10px;
  transition: background-color 0.2s ease;
}

.drawer-content button:hover {
  background-color: #444;
}

.comment {
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.comment:last-child {
  border-bottom: none;
}

.comment-date {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
  display: block;
}

/* Star Rating Styles */
.star {
  font-size: 24px;
  color: #555;
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 0 2px;
}

.star.filled {
  color: #ffd700;
  text-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
}

.star.interactive:hover {
  transform: scale(1.2);
  color: #ffd700;
}

.rating-animation {
  animation: pulse 0.5s ease-in-out;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* Camera Interface Styles */
.camera-interface {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.camera-content {
  width: 90%;
  max-width: 500px;
  background-color: var(--background-darker);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.camera-preview {
  margin: 20px 0;
  height: 300px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.camera-placeholder {
  width: 100%;
  height: 100%;
  background-color: #333;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #999;
}

.camera-controls {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

.camera-controls button {
  padding: 12px 20px;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.cancel-btn {
  background-color: #555;
  color: white;
}

.cancel-btn:hover {
  background-color: #666;
}

.record-btn {
  background-color: #ff4d4d;
  color: white;
}

.record-btn:hover {
  background-color: #ff6666;
}

.upload-btn {
  background-color: #4d79ff;
  color: white;
}

.upload-btn:hover {
  background-color: #668cff;
}

/* Loading and Error Overlays */
.loading-overlay, .error-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 3000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
}

.loading-spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top: 4px solid white;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-btn {
  padding: 12px 24px;
  background-color: #4d79ff;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 20px;
}

.retry-btn:hover {
  background-color: #668cff;
}

/* Settings Menu Styles */
.settings-btn {
  font-size: 24px;
  cursor: pointer;
  margin-bottom: 20px;
  color: white;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}

.settings-menu {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.settings-content {
  width: 90%;
  max-width: 500px;
  background-color: var(--background-darker);
  border-radius: 12px;
  padding: 20px;
}

.settings-content h3 {
  text-align: center;
  margin-top: 0;
  color: white;
}

.settings-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.settings-option label {
  color: white;
  font-size: 16px;
}

.settings-option input {
  width: 20px;
  height: 20px;
}

.close-btn {
  width: 100%;
  padding: 12px;
  background-color: #4d79ff;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 20px;
}

.close-btn:hover {
  background-color: #668cff;
}

/* Download Modal Styles */
.download-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.download-modal-content {
  background-color: var(--background-darker);
  border-radius: 10px;
  padding: 20px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.download-modal-content h3 {
  margin-top: 0;
  color: var(--text-primary);
  text-align: center;
}

.download-modal-content p {
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 20px;
}

.resolution-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.resolution-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 5px;
  padding: 12px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.resolution-btn:hover {
  background-color: var(--accent-hover);
}

.download-btn {
  font-size: 20px;
  cursor: pointer;
  color: var(--text-primary);
  background: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
}

.download-btn:hover {
  background: rgba(0, 0, 0, 0.5);
}

</style>