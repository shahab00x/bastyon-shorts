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
        <!-- Top-right settings button -->
        <button class="settings-top-right" @click.stop="toggleSettingsMenu" aria-label="Settings">⚙</button>
        <video 
          ref="videoElements"
          :src="getVideoSource(video.url)" 
          autoplay 
          :muted="isMuted" 
          playsinline
          webkit-playsinline
          x5-playsinline
          preload="metadata"
          @click="togglePlayPause(index)"
          @loadeddata="onVideoLoaded(index)"
          @loadedmetadata="onLoadedMetadata(index)"
          @timeupdate="onTimeUpdate(index)"
          @progress="onProgressUpdate(index)"
          @ended="nextVideo"
          @canplay="onVideoCanPlay(index)"
          @play="onVideoPlay(index)"
          @pause="onVideoPause(index)"
        ></video>

        <!-- Buffering spinner -->
        <div v-if="bufferingIndex === index" class="buffering-overlay">
          <div class="spinner"></div>
        </div>

        <!-- Pause overlay -->
        <div v-if="pausedOverlayIndex === index" class="pause-overlay" @click.stop="togglePlayPause(index)">
          ▶
        </div>

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
              <div class="uploader">
                <div 
                  v-if="video.uploaderAvatar && !avatarError[index]"
                  class="usericon"
                  :style="{
                    backgroundImage: `url(${video.uploaderAvatar})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center center',
                    backgroundRepeat: 'no-repeat'
                  }"
                >
                  <sup v-if="video.uploaderReputation != null" class="rep-badge">{{ formatAbbrev(video.uploaderReputation) }}</sup>
                </div>
                <div v-else class="uploader-avatar-fallback">
                  {{ (video.uploader || '?').charAt(0).toUpperCase() }}
                  <sup v-if="video.uploaderReputation != null" class="rep-badge">{{ formatAbbrev(video.uploaderReputation) }}</sup>
                </div>
                <span class="uploader-name">@{{ video.uploader }}</span>
              </div>
              <span class="video-date">
                {{ video.formattedDate }}<template v-if="video.views != null"> · {{ formatAbbrev(video.views) }} views</template>
              </span>
              <button class="follow-btn">Follow</button>
            </div>
            <div 
              class="video-description" 
              @click="toggleDescriptionDrawer"
            >
              <p>{{ truncateDescription(video.description) }}</p>
            </div>

            <!-- Light blue seekbar below description & follow -->
            <div 
              class="seekbar"
              @mousedown.stop.prevent="onSeekStart($event, index)"
              @touchstart.stop.prevent="onSeekStart($event, index)"
            >
              <div class="seekbar-track" ref="seekbarTracks">
                <div class="seekbar-buffered" :style="{ width: (bufferedPercents[index] || 0) + '%' }"></div>
                <div class="seekbar-fill" :style="{ width: (progressPercents[index] || 0) + '%' }"></div>
              </div>
            </div>
          </div>
          
          <div class="right-panel">
            <!-- Compact rating: single star that expands on tap -->
            <div class="star-rating compact">
              <button class="star-toggle" @click.stop="toggleRatingExpand(index)" :aria-expanded="ratingExpandedIndex === index">
                <span class="star" :class="{ 'filled': (video.userRating || Math.round(video.averageRating || 1)) >= 1 }">★</span>
                <span class="rating-value">{{ (video.userRating || Math.round(video.averageRating || 1)) }}</span>
              </button>
              <div v-if="ratingExpandedIndex === index" class="star-chooser">
                <button v-for="i in 5" :key="i" class="star opt" @click.stop="chooseRating(i, index)">★ {{ i }}</button>
              </div>
            </div>
            
            <div class="comments-icon" @click="toggleCommentsDrawer">
              💬
              <span class="comments-badge">{{ video.comments || 0 }}</span>
            </div>
            
            <div class="share-btn" @click="shareVideo">
              🔗
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

<script lang="ts">
import { defineComponent, nextTick } from 'vue'
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
      userWantsSound: false,
      // UI state
      bufferingIndex: null,
      pausedOverlayIndex: null,
      ratingExpandedIndex: null,
      avatarError: {},
      // i18n / language for playlist
      lang: (navigator.language || 'en').slice(0, 2).toLowerCase(),
      supportedLangs: ['en','ru','de','fr','ko','es','it','zh'],
      // seekbar state per index
      durations: [],
      currentTimes: [],
      progressPercents: [],
      bufferedPercents: [],
      seekingIndex: null
    };
  },
  computed: {
    currentVideo() {
      return this.playlist[this.currentIndex]
    }
  },
  methods: {
    toggleRatingExpand(index) {
      this.ratingExpandedIndex = this.ratingExpandedIndex === index ? null : index
    },
    chooseRating(i, index) {
      this.rateVideo(i, index)
      this.ratingExpandedIndex = null
    },
    formatAbbrev(num) {
      const n = Number(num) || 0
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M'
      if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K'
      return String(n)
    },
    async ensureUploaderProfiles() {
      try {
        const missing = Array.from(new Set(
          this.playlist
            .filter(v => (!v.uploaderAvatar || v.uploader === v.uploaderAddress || !v.uploader) && v.uploaderAddress)
            .map(v => v.uploaderAddress)
            .filter(Boolean)
        ))
        if (!missing.length) return
        // Try batch fetch first
        try {
          const resp = await bastyonApi.fetchProfiles(missing)
          const profiles = Array.isArray(resp?.profiles) ? resp.profiles : []
          for (const p of profiles) {
            const addr = p?.address
            if (!addr) continue
            this.playlist = this.playlist.map(v => {
              if (v.uploaderAddress === addr) {
                const enriched = { ...v }
                if (!enriched.uploader || enriched.uploader === v.uploaderAddress) {
                  if (p?.name) enriched.uploader = p.name
                }
                if (!enriched.uploaderAvatar && p?.avatar) enriched.uploaderAvatar = p.avatar
                if (enriched.uploaderReputation == null && typeof p?.reputation === 'number') enriched.uploaderReputation = p.reputation
                return enriched
              }
              return v
            })
          }
        } catch (_) {
          // Fallback to per-address fetch
          for (const addr of missing) {
            try {
              const p = await bastyonApi.fetchProfile(addr)
              this.playlist = this.playlist.map(v => {
                if (v.uploaderAddress === addr) {
                  const enriched = { ...v }
                  if (!enriched.uploader || enriched.uploader === v.uploaderAddress) {
                    if (p?.name) enriched.uploader = p.name
                  }
                  if (!enriched.uploaderAvatar && p?.avatar) enriched.uploaderAvatar = p.avatar
                  if (enriched.uploaderReputation == null && typeof p?.reputation === 'number') enriched.uploaderReputation = p.reputation
                  return enriched
                }
                return v
              })
            } catch {}
          }
        }
      } catch (e) {
        console.warn('ensureUploaderProfiles failed:', e)
      }
    },
    markAvatarError(index: number) {
      this.avatarError[index] = true
    },
    // Dedupe videos by their unique hash/id/txid while preserving order
    dedupeByHash(list) {
      const seen = new Set()
      const out = []
      for (const v of Array.isArray(list) ? list : []) {
        const h = String(v?.hash ?? v?.id ?? v?.txid ?? '')
        if (!h || seen.has(h)) continue
        seen.add(h)
        out.push(v)
      }
      return out
    },
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
    async addComment() {
      try {
        const v = this.currentVideo
        if (!v || !this.newComment.trim()) return
        const userAddress = 'user_address_placeholder'
        await bastyonApi.postComment(v.hash || v.id, this.newComment.trim(), userAddress)
        // Optimistically append
        const newItem = {
          id: `local-${Date.now()}`,
          user: userAddress.substring(0, 6) + '…' + userAddress.substring(userAddress.length - 4),
          text: this.newComment.trim(),
          timestamp: new Date().toISOString()
        }
        v.commentData = Array.isArray(v.commentData) ? [...v.commentData, newItem] : [newItem]
        this.newComment = ''
      } catch (e) {
        console.warn('Failed to post comment:', e)
      }
    },
    async donateToCreator() {
      try {
        const v = this.currentVideo
        if (!v || !v.uploaderAddress) return
        // Placeholder fixed amount
        await bastyonApi.donatePKoin(v.uploaderAddress, 1, 'user_address_placeholder')
        alert('Donation sent!')
      } catch (e) {
        console.warn('Donation failed:', e)
        alert('Donation failed')
      }
    },
    // Setup HLS for a particular video index if supported and hlsUrl is present
    setupHlsForIndex(index) {
      const video = this.playlist[index];
      if (!video) return;
      const hlsUrl = video?.videoInfo?.peertube?.hlsUrl;
      if (!hlsUrl) return;

      const videoEl = this.$refs.videoElements?.[index] || this.$refs.videoElements;
      if (!videoEl) return;

      if (this.hlsPlayers.has(index)) return;

      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = hlsUrl;
        // On Safari (native HLS), wait for canplay then play
        const onCanPlay = () => {
          try {
            if (this.userWantsSound) {
              this.isMuted = false;
              videoEl.muted = false;
              videoEl.volume = 1.0;
            }
            videoEl.play().catch(() => {});
          } catch (_) {}
          videoEl.removeEventListener('canplay', onCanPlay);
        };
        videoEl.addEventListener('canplay', onCanPlay);
        return;
      }

      if (Hls && Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true, backBufferLength: 60 });
        hls.loadSource(hlsUrl)
        hls.attachMedia(videoEl)
        this.hlsPlayers.set(index, hls)

        const tryPlay = () => {
          try {
            if (this.userWantsSound) {
              this.isMuted = false;
              videoEl.muted = false;
              videoEl.volume = 1.0;
            }
            videoEl.play().catch(() => {});
          } catch (_) {}
        };

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          // Media attached, wait for manifest then try play
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          tryPlay();
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data?.fatal) {
            try { hls.destroy(); } catch (_) {}
            this.hlsPlayers.delete(index);
          }
        });
        hls.on(Hls.Events.BUFFER_STALLED, () => { this.bufferingIndex = index; });
        hls.on(Hls.Events.BUFFER_APPENDED, () => { if (this.bufferingIndex === index) this.bufferingIndex = null; });
      }
    },
    // Toggle play/pause on tap
    togglePlayPause(index) {
      const videoEl = this.$refs.videoElements?.[index] || this.$refs.videoElements;
      if (!videoEl) return;
      if (videoEl.paused) {
        this.pausedOverlayIndex = null;
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
        this.pausedOverlayIndex = index;
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
    // Ensure refs are captured safely
    cacheVideoElements() {
      // Vue keeps refs updated after nextTick; no-op placeholder for clarity
    },
    onLoadedMetadata(index) {
      const videoEl = this.$refs.videoElements?.[index] || this.$refs.videoElements;
      if (!videoEl || isNaN(videoEl.duration)) return;
      this.durations[index] = videoEl.duration;
      // Initialize buffered/progress when metadata is ready
      this.onProgressUpdate(index);
      this.onTimeUpdate(index);
    },
    onTimeUpdate(index) {
      const videoEl = this.$refs.videoElements?.[index] || this.$refs.videoElements;
      const dur = this.durations[index] || videoEl?.duration || 0;
      if (!videoEl || !dur || !isFinite(dur)) return;
      const pct = Math.max(0, Math.min(100, (videoEl.currentTime / dur) * 100));
      this.progressPercents[index] = pct;
      this.currentTimes[index] = videoEl.currentTime;
    },
    onProgressUpdate(index) {
      const videoEl = this.$refs.videoElements?.[index] || this.$refs.videoElements;
      const dur = this.durations[index] || videoEl?.duration || 0;
      if (!videoEl || !dur || !isFinite(dur)) return;
      try {
        const buf = videoEl.buffered;
        let end = 0;
        if (buf && buf.length) {
          end = buf.end(buf.length - 1);
        }
        const pct = Math.max(0, Math.min(100, (end / dur) * 100));
        this.bufferedPercents[index] = pct;
      } catch (_) {}
    },
    onSeekStart(e, index) {
      this.seekingIndex = index;
      this.onSeekMove(e, index);
      const move = (ev) => this.onSeekMove(ev, index);
      const up = () => {
        this.onSeekEnd(index);
        window.removeEventListener('mousemove', move);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('mouseup', up);
        window.removeEventListener('touchend', up);
        window.removeEventListener('touchcancel', up);
      };
      window.addEventListener('mousemove', move, { passive: false });
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('mouseup', up, { passive: true });
      window.addEventListener('touchend', up, { passive: true });
      window.addEventListener('touchcancel', up, { passive: true });
    },
    onSeekMove(e, index) {
      if (this.seekingIndex !== index) return;
      const track = (this.$refs.seekbarTracks && Array.isArray(this.$refs.seekbarTracks))
        ? this.$refs.seekbarTracks[index]
        : this.$refs.seekbarTracks;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const clientX = this._eventClientX(e);
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const videoEl = this.$refs.videoElements?.[index] || this.$refs.videoElements;
      const dur = this.durations[index] || videoEl?.duration || 0;
      if (videoEl && dur && isFinite(dur)) {
        try { videoEl.currentTime = frac * dur; } catch (_) {}
        const pct = frac * 100;
        this.progressPercents[index] = pct;
      }
    },
    onSeekEnd(index) {
      this.seekingIndex = null;
    },
    _eventClientX(e) {
      if (e.touches && e.touches.length) return e.touches[0].clientX;
      if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX;
      return e.clientX;
    },
    async fetchVideos() {
      // Set loading state
      this.loading = true;
      this.error = null;
      
      try {
        let videos = []
        const effectiveLang = this.supportedLangs.includes(this.lang) ? this.lang : 'en'
        try {
          videos = await bastyonApi.fetchPlaylist(effectiveLang);
        } catch (e) {
          console.warn('Static playlist fetch failed, falling back to API:', e);
        }
        if (!Array.isArray(videos) || videos.length === 0) {
          try {
            videos = await bastyonApi.fetchBShorts();
          } catch (e) {
            console.warn('API fetch failed:', e);
            videos = []
          }
        }
        // If still empty, fallback to mock data for demo
        if (!Array.isArray(videos) || videos.length === 0) {
          videos = [
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
          ]
        }
        if (Array.isArray(videos)) {
          let list = this.dedupeByHash(videos)
          list = list.filter(v => v && v.hasVideo !== false)
          list = list.filter(v => !v.duration || v.duration < 120)
          this.playlist = list
          // init seek arrays
          this.progressPercents = new Array(this.playlist.length).fill(0)
          this.bufferedPercents = new Array(this.playlist.length).fill(0)
          this.durations = new Array(this.playlist.length).fill(0)
          this.currentTimes = new Array(this.playlist.length).fill(0)
          this.$nextTick(() => {
            this.cacheVideoElements();
            this.setupHlsForIndex(0);
          });
          // Best-effort: fill missing uploader avatars/names/reps
          await this.ensureUploaderProfiles()
        }
        // Initialize video cache
        this.initializeVideoCache();
        // Hide error overlay if we have fallback content
        this.error = null;
      } catch (error) {
        console.error('Error fetching videos:', error);
        // Fallback to mock data if API totally fails
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
        // Hide error overlay since we show fallback content
        this.error = null;
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
        videoElement.src = this.getVideoSource(video.url);
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
    async loadCommentsForCurrent() {
      try {
        const v = this.currentVideo
        if (!v || !v.hash) return
        const result = await bastyonApi.fetchComments(v.hash, { limit: 50, includeProfiles: true })
        const profiles = result?.profiles || {}
        const mapped = (result?.comments || []).map(c => {
          const prof = c.address ? profiles[c.address] : null
          return {
            ...c,
            user: prof?.name || c.user,
            avatar: prof?.avatar,
            reputation: prof?.reputation
          }
        })
        this.$set ? this.$set(v, 'commentData', mapped) : (v.commentData = mapped)
        // Update count if provided
        if (Number.isFinite(result?.count)) v.comments = Number(result.count)
      } catch (e) {
        console.warn('Failed to load comments:', e)
      }
    },
    async toggleCommentsDrawer() {
      const opening = !this.showCommentsDrawer
      this.showCommentsDrawer = opening;
      if (opening) {
        await this.loadCommentsForCurrent()
      }
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
      console.log(`Video ${index} playing`);
      if (this.bufferingIndex === index) this.bufferingIndex = null;
      if (this.pausedOverlayIndex === index) this.pausedOverlayIndex = null;
    },
    onVideoPause(index) {
      console.log(`Video ${index} paused`);
      this.pausedOverlayIndex = index;
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
/* Light blue themed seekbar inspired by TikTok/YouTube Shorts */
.seekbar {
  position: relative; /* inside bottom-section flow */
  width: 100%;
  margin-top: 8px;
  height: 20px; /* tap target height */
  display: flex;
  align-items: center;
  z-index: 6;
}
.seekbar-track {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: rgba(255,255,255,0.25);
  overflow: hidden;
}
.seekbar-buffered {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(90, 200, 250, 0.35); /* light blue buffer */
}
.seekbar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: #5ac8fa; /* iOS light blue */
}
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

/* Buffering overlay */
.buffering-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Pause overlay */
.pause-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.25);
  color: #fff;
  font-size: 60px;
  line-height: 1;
}

/* Avatar fallback */
.uploader-avatar-fallback {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #555;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-right: 8px;
}

.video-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
}

/* Bastyon-style avatar */
.usericon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  margin-right: 8px;
  background-color: #333;
}

.rep-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: rgba(0,0,0,0.7);
  color: #fff;
  border-radius: 8px;
  font-size: 10px;
  padding: 1px 4px;
}

/* Top-right settings */
.settings-top-right {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 5;
  background: rgba(0,0,0,0.35);
  color: #fff;
  border: none;
  border-radius: 16px;
  padding: 6px 10px;
}

/* Compact star rating */
.star-rating.compact { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.star-toggle {
  background: rgba(0,0,0,0.35);
  color: #fff;
  border: none;
  border-radius: 16px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.star-chooser {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(0,0,0,0.5);
  padding: 8px;
  border-radius: 8px;
}
.star-chooser .opt { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 4px 8px; }

/* Drawer polish */
.drawer-content { border-top-left-radius: 12px; border-top-right-radius: 12px; }
.description-drawer .drawer-content h3,
.comments-drawer .drawer-content h3 { margin-top: 8px; }

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