<template>
  <div class="video-player-container">
    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <img class="logo-spinner" src="/bastyon_logo.png" alt="Loading" />
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
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    >
      <div 
        v-for="(video, index) in playlist" 
        :key="video.hash || video.id || index" 
        class="video-slide"
        :class="{ 'active': currentIndex === index, 'above': index < currentIndex, 'below': index > currentIndex }"
      >
        <!-- Top-right settings button -->
        <button class="settings-top-right" @click.stop="toggleSettingsMenu" aria-label="Settings">⚙</button>
        <video 
          ref="videoElements"
          :src="currentIndex === index ? resolvedSrc(index, video) : ''" 
          :muted="isMuted" 
          :autoplay="settings.autoplay"
          playsinline
          webkit-playsinline
          x5-playsinline
          :preload="currentIndex === index ? 'metadata' : 'none'"
          crossorigin="anonymous"
          :class="videoFit[index] === 'contain' ? 'fit-contain' : 'fit-cover'"
          @click="togglePlayPause($event, index)"
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
        <div v-if="pausedOverlayIndex === index" class="pause-overlay" @click.stop="togglePlayPause($event, index)">
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
              <button class="follow-btn">Follow</button>
            </div>
            <div 
              class="video-description" 
              @click="toggleDescriptionDrawer"
            >
              <p>
                {{ truncateDescription(video.description) }}
                <span class="video-date-inline">
                  {{ video.formattedDate }}
                  <template v-if="video.views != null"> · {{ formatAbbrev(video.views) }} views</template>
                </span>
              </p>
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
              <button class="star-toggle" @click.stop="toggleRatingExpand(index)" :aria-expanded="ratingExpandedIndex === index" :title="`${Number(video.averageRating||0).toFixed(1)} avg · ${formatAbbrev(video.ratingsCount||0)} ratings`">
                <span class="star" :class="{ 'filled': ((video.userRating != null ? video.userRating : Math.round(video.averageRating || 0)) >= 1) }">★</span>
                <span class="rating-value">{{ Number(video.averageRating || 0).toFixed(1) }}</span>
                <span class="rating-count">({{ formatAbbrev(video.ratingsCount || 0) }})</span>
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
    
    <!-- Screen Tint Overlay -->
    <div 
      class="screen-tint" 
      :class="{ 'visible': showDescriptionDrawer || showCommentsDrawer }" 
      @click="closeAnyDrawer"
    ></div>
    
    <!-- Description Drawer -->
    <div 
      class="description-drawer" 
      :class="{ 'open': showDescriptionDrawer }"
      @touchstart="handleDrawerTouchStart"
      @touchmove="handleDrawerTouchMove"
      @touchend="handleDrawerTouchEnd"
      @touchstart.self="closeAnyDrawer"
      @touchend.self="closeAnyDrawer"
      @click.self="closeAnyDrawer"
    >
      <div class="drawer-content" @click.stop>
        <div class="drawer-header"><h3>Video Description</h3></div>
        <p>{{ currentVideo?.description }}</p>
      </div>
    </div>
    
    <!-- Comments Drawer -->
    <div 
      class="comments-drawer" 
      :class="{ 'open': showCommentsDrawer }"
      @touchstart="handleDrawerTouchStart"
      @touchmove="handleDrawerTouchMove"
      @touchend="handleDrawerTouchEnd"
      @touchstart.self="closeAnyDrawer"
      @touchend.self="closeAnyDrawer"
      @click.self="closeAnyDrawer"
    >
      <div class="drawer-content" @click.stop ref="commentsContent" @scroll.passive="onCommentsScroll">
        <div class="drawer-header"><h3>Comments<span v-if="currentVideo?.comments != null">({{ currentVideo.comments }})</span></h3></div>
        <div class="comments-list">
          <!-- No comments state -->
          <div v-if="!commentsLoading && (!currentVideo?.commentData || currentVideo.commentData.length === 0)" class="no-comments">
            No comments yet
          </div>
          <!-- Loading comments indicator -->
          <div v-if="commentsLoading && (!currentVideo?.commentData || currentVideo.commentData.length === 0)" class="comments-loading">
            <img class="logo-spinner small" src="/bastyon_logo.png" alt="Loading comments" />
          </div>
          <div 
            v-for="(comment, cIdx) in currentVideo?.commentData" 
            :key="comment.id || comment.hash || cIdx" 
            class="comment"
          >
            <div 
              v-if="comment.avatar"
              class="usericon"
              :style="{
                backgroundImage: `url(${comment.avatar})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat'
              }"
            >
              <sup v-if="comment.reputation != null" class="rep-badge">{{ formatAbbrev(comment.reputation) }}</sup>
            </div>
            <div v-else class="uploader-avatar-fallback">
              {{ (comment.user || '?').charAt(0).toUpperCase() }}
            </div>
            <div class="comment-content">
              <div class="comment-header">
                <strong class="comment-author">{{ comment.user }}</strong>
                <span class="comment-date">{{ comment.timestamp }}</span>
              </div>
              <p class="comment-text">{{ comment.text }}</p>
              <div class="comment-actions">
                <button class="action-btn thumb" title="Like" aria-label="Like">
                  👍
                  <span v-if="Number(comment.scoreUp) > 0" class="count">{{ formatAbbrev(comment.scoreUp) }}</span>
                </button>
                <button class="action-btn thumb" title="Dislike" aria-label="Dislike">
                  👎
                  <span v-if="Number(comment.scoreDown) > 0" class="count">{{ formatAbbrev(comment.scoreDown) }}</span>
                </button>
                <button class="action-btn reply-btn" @click="replyToComment(comment)">Reply</button>
              </div>
              <div v-if="(comment.replies && comment.replies.length) || Number(comment.replyCount) > 0" class="replies-toggle">
                <button class="action-btn toggle-replies" @click="toggleReplies(cIdx)">
                  <template v-if="comment.showReplies">Hide replies</template>
                  <template v-else>View replies ({{ (comment.replies && comment.replies.length) || comment.replyCount || 0 }})</template>
                </button>
              </div>
              <div v-if="comment.showReplies && comment.replies && comment.replies.length" class="replies-list">
                <div 
                  v-for="(reply, rIdx) in comment.replies"
                  :key="reply.id || rIdx"
                  class="reply"
                >
                  <div 
                    v-if="reply.avatar"
                    class="usericon"
                    :style="{
                      backgroundImage: `url(${reply.avatar})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center center',
                      backgroundRepeat: 'no-repeat'
                    }"
                  >
                    <sup v-if="reply.reputation != null" class="rep-badge">{{ formatAbbrev(reply.reputation) }}</sup>
                  </div>
                  <div v-else class="uploader-avatar-fallback">
                    {{ (reply.user || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="comment-content">
                    <div class="comment-header">
                      <strong class="comment-author">{{ reply.user }}</strong>
                      <span class="comment-date">{{ reply.timestamp }}</span>
                    </div>
                    <p class="comment-text">{{ reply.text }}</p>
                    <div class="comment-actions">
                      <button class="action-btn thumb" title="Like reply" aria-label="Like reply">
                        👍
                        <span v-if="Number(reply.scoreUp) > 0" class="count">{{ formatAbbrev(reply.scoreUp) }}</span>
                      </button>
                      <button class="action-btn thumb" title="Dislike reply" aria-label="Dislike reply">
                        👎
                        <span v-if="Number(reply.scoreDown) > 0" class="count">{{ formatAbbrev(reply.scoreDown) }}</span>
                      </button>
                      <button class="action-btn reply-btn" @click="replyToComment(reply)">Reply</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Loading more indicator -->
        <div v-if="commentsLoading && currentVideo?.commentData && currentVideo.commentData.length > 0" class="comments-loading more">
          <img class="logo-spinner small" src="/bastyon_logo.png" alt="Loading more comments" />
        </div>
        <!-- Sticky footer: add comment + donate -->
        <div class="drawer-footer">
          <div class="add-comment-row">
            <input
              type="text"
              v-model="newComment"
              placeholder="Add a comment..."
              @keyup.enter="submitComment"
              aria-label="Add a comment"
            />
            <button
              class="send-btn"
              :disabled="!newComment || !newComment.trim()"
              @click="submitComment"
              title="Post comment"
              aria-label="Post comment"
            >📨</button>
          </div>
          <div class="donate-row">
            <span class="donate-label">Donate</span>
            <button :class="['donate-chip', { active: selectedDonate === 1 }]" @click="selectDonate(1)" aria-label="Donate 1 pkoin">🪙 1</button>
            <button :class="['donate-chip', { active: selectedDonate === 2 }]" @click="selectDonate(2)" aria-label="Donate 2 pkoins">🪙 2</button>
            <button :class="['donate-chip', { active: selectedDonate === 5 }]" @click="selectDonate(5)" aria-label="Donate 5 pkoins">🪙 5</button>
            <button :class="['donate-chip', 'custom', { active: selectedDonate === 'custom' }]" @click="selectCustomDonate" aria-label="Donate custom amount">Custom amount</button>
          </div>
        </div>
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
      selectedDonate: null as any,
      touchStartY: 0,
      touchStartX: 0,
      touchStartTime: 0,
      drawerTouchStartY: 0, // For drawer swipe handling
      drawerTouchStartX: 0,
      drawerSwipeEligible: false,
      drawerSwipeFromHeader: false,
      drawerActiveContentEl: null as any,
      drawerTouchStartTime: 0,
      // Treat as mobile only when touch is supported
      isMobile: (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator && navigator.maxTouchPoints > 0)),
      // Mouse-based swipe support (desktop)
      mouseDown: false,
      mouseStartY: 0,
      mouseStartX: 0,
      mouseStartTime: 0,
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
      // per-video fit mode: 'cover' | 'contain'
      videoFit: [],
      // i18n / language for playlist
      lang: (navigator.language || 'en').slice(0, 2).toLowerCase(),
      supportedLangs: ['en','ru','de','fr','ko','es','it','zh'],
      // seekbar state per index
      durations: [],
      currentTimes: [],
      progressPercents: [],
      bufferedPercents: [],
      seekingIndex: null,
      // comments pagination/loading
      commentsLoading: false,
      commentsPageSize: 10
    };
  },
  computed: {
    currentVideo() {
      return this.playlist[this.currentIndex]
    }
  },
  watch: {
    currentIndex(newIndex, oldIndex) {
      // When the active slide changes, ensure only that slide plays
      this.$nextTick(() => {
        this.ensureOnlyActivePlaying();
        this.setupHlsForIndex(this.currentIndex);
        this.updateVideoFitForIndex(this.currentIndex);
        if (typeof oldIndex === 'number' && oldIndex !== newIndex) {
          // Clean up HLS on the previous slide to avoid GPU/decoder contention on mobile
          this.destroyHlsForIndex(oldIndex);
        }
      });
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
    // Decide if we should use hls.js (MSE) instead of native
    shouldUseHlsJs(index, video) {
      try {
        const v = video || this.playlist?.[index];
        const hlsUrl = v?.videoInfo?.peertube?.hlsUrl;
        const el = this.$refs.videoElements?.[index] || this.$refs.videoElements;
        const nativeHls = el && typeof el.canPlayType === 'function' && el.canPlayType('application/vnd.apple.mpegurl');
        return !!(hlsUrl && typeof Hls !== 'undefined' && Hls && Hls.isSupported() && !nativeHls);
      } catch (_) { return false; }
    },
    // Resolve the best initial src for this device
    resolvedSrc(index, video) {
      try {
        const v = video || this.playlist?.[index];
        if (!v) return '';
        const hlsUrl = v?.videoInfo?.peertube?.hlsUrl;
        const el = this.$refs.videoElements?.[index] || this.$refs.videoElements;
        // If we'll use hls.js, do not bind a src so hls can take over cleanly
        if (this.shouldUseHlsJs(index, v)) return '';
        if (hlsUrl && el && typeof el.canPlayType === 'function' && el.canPlayType('application/vnd.apple.mpegurl')) {
          return hlsUrl;
        }
        return this.getVideoSource(v.url);
      } catch (_) { return this.getVideoSource(video?.url); }
    },
    async addComment() {
      try {
        const v = this.currentVideo
        if (!v || !this.newComment.trim()) return
        const userAddress = 'user_address_placeholder'
        const videoId = v.hash || v.id || v.txid
        if (!videoId) return
        await bastyonApi.postComment(videoId, this.newComment.trim(), userAddress)
        // Optimistically append
        const newItem = {
          id: `local-${Date.now()}`,
          user: userAddress.substring(0, 6) + '…' + userAddress.substring(userAddress.length - 4),
          text: this.newComment.trim(),
          timestamp: new Date().toISOString()
        }
        v.commentData = Array.isArray(v.commentData) ? [...v.commentData, newItem] : [newItem]
        if (typeof v.comments === 'number') v.comments += 1
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
            if (!this.userWantsSound) {
              // Ensure autoplay policy passes
              this.isMuted = true;
              videoEl.muted = true;
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
            if (!this.userWantsSound) {
              // Ensure autoplay policy passes
              this.isMuted = true;
              videoEl.muted = true;
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
            // Fallback to progressive MP4 if HLS fails (helps on some mobile/LAN setups)
            try {
              const fallback = this.getVideoSource(video?.url);
              if (fallback) {
                videoEl.src = fallback;
                videoEl.load();
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
              }
            } catch (_) {}
          }
        });
        hls.on(Hls.Events.BUFFER_STALLED, () => { this.bufferingIndex = index; });
        hls.on(Hls.Events.BUFFER_APPENDED, () => { if (this.bufferingIndex === index) this.bufferingIndex = null; });
      }
    },
    // Toggle play/pause on tap
    togglePlayPause(e, index) {
      // Always operate on the active slide to avoid layering issues
      let videoEl = null;
      try {
        const activeSlide = this.$el.querySelector('.video-slide.active');
        if (activeSlide) {
          videoEl = activeSlide.querySelector('video');
        }
      } catch (_) {}
      // Fallback: use event target or refs
      if (!videoEl && e && e.currentTarget && e.currentTarget.tagName === 'VIDEO') {
        videoEl = e.currentTarget;
      }
      if (!videoEl) videoEl = this.$refs.videoElements?.[this.currentIndex] || this.$refs.videoElements;
      if (!videoEl) return;
      if (videoEl.paused) {
        this.pausedOverlayIndex = null;
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
        this.pausedOverlayIndex = this.currentIndex;
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
    // Compute per-video fit: choose 'cover' when cropping keeps >=75% visible, else 'contain'
    updateVideoFitForIndex(index, el) {
      try {
        const videoEl = el || this.$refs.videoElements?.[index] || this.$refs.videoElements;
        if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return;
        const vw = Number(videoEl.videoWidth);
        const vh = Number(videoEl.videoHeight);
        if (!vw || !vh) return;
        // Use container dimensions (full-screen slide)
        let cw = window.innerWidth || 0;
        let ch = window.innerHeight || 0;
        try {
          const container = this.$el?.querySelector?.('.video-slide.active') || this.$el;
          const rect = container?.getBoundingClientRect?.();
          if (rect && rect.width && rect.height) { cw = rect.width; ch = rect.height; }
        } catch (_) {}
        if (!cw || !ch) return;
        const Av = vw / vh; // video aspect
        const Ac = cw / ch; // container aspect
        const visibleFractionCover = Math.min(Av, Ac) / Math.max(Av, Ac); // fraction visible when using cover
        // If cover would hide more than 25%, switch to contain
        this.$set ? this.$set(this.videoFit, index, (visibleFractionCover >= 0.75 ? 'cover' : 'contain'))
                  : (this.videoFit[index] = (visibleFractionCover >= 0.75 ? 'cover' : 'contain'));
      } catch (_) {}
    },
    // Metadata loaded: set duration and compute best fit mode
    onLoadedMetadata(index) {
      const videoEl = this.$refs.videoElements?.[index] || this.$refs.videoElements;
      if (videoEl) {
        try {
          const dur = Number(videoEl.duration);
          if (Number.isFinite(dur) && dur > 0) this.durations[index] = dur;
        } catch (_) {}
        this.updateVideoFitForIndex(index, videoEl);
      }
    },
    // Loaded data/canplay/play/pause handlers to manage UI state safely
    onVideoLoaded(index) {
      if (this.bufferingIndex === index) this.bufferingIndex = null;
    },
    onVideoCanPlay(index) {
      if (this.bufferingIndex === index) this.bufferingIndex = null;
    },
    onVideoPlay(index) {
      this.isVideoPlaying = true;
      if (this.pausedOverlayIndex === index) this.pausedOverlayIndex = null;
    },
    onVideoPause(index) {
      this.isVideoPlaying = false;
      if (this.currentIndex === index) this.pausedOverlayIndex = index;
    },
    // Ensure only the active slide's video is playing
    ensureOnlyActivePlaying() {
      try {
        const refs = this.$refs.videoElements;
        const list = Array.isArray(refs) ? refs : (refs ? [refs] : []);
        list.forEach((el, i) => {
          if (!el) return;
          try {
            if (i === this.currentIndex) {
              if (this.settings?.autoplay && el.paused) el.play().catch(() => {});
            } else {
              if (!el.paused) el.pause();
            }
          } catch (_) {}
        });
      } catch (_) {}
    },
    // Recompute fit on viewport resize
    onWindowResize() {
      this.updateVideoFitForIndex(this.currentIndex);
    },
    // Ensure refs are captured safely
    cacheVideoElements() {
      // Vue keeps refs updated after nextTick; no-op placeholder for clarity
    },
    // Pause all non-active videos and play only the active one
    ensureOnlyActivePlaying() {
      const refs = this.$refs.videoElements;
      if (!refs) return;
      const list = Array.isArray(refs) ? refs : [refs];
      for (let i = 0; i < list.length; i++) {
        const el = list[i];
        if (!el) continue;
        if (i !== this.currentIndex) {
          try { el.pause(); } catch (_) {}
        }
      }
      const active = list[this.currentIndex];
      if (active) {
        try {
          if (this.userWantsSound) {
            this.isMuted = false;
            active.muted = false;
            active.volume = 1.0;
          }
          active.play().catch(() => {});
        } catch (_) {}
      }
    },
    onLoadedMetadata(index) {
      const videoEl = this.$refs.videoElements?.[index] || this.$refs.videoElements;
      if (!videoEl || isNaN(videoEl.duration)) return;
      this.durations[index] = videoEl.duration;
      // Initialize buffered/progress when metadata is ready
      this.onProgressUpdate(index);
      this.onTimeUpdate(index);
      // Decide best fit for this video's aspect ratio on this device
      this.updateVideoFit(index);
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
        // Prefer server-enriched results (includes views, comments enrichment, profiles)
        try {
          videos = await bastyonApi.fetchBShorts(effectiveLang);
        } catch (e) {
          console.warn('API fetch failed, will try static playlist:', e);
        }
        // Fallback to static playlist if API empty or failed
        if (!Array.isArray(videos) || videos.length === 0) {
          try {
            videos = await bastyonApi.fetchPlaylist(effectiveLang);
          } catch (e) {
            console.warn('Static playlist fetch failed:', e);
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
              userRating: 0,
              averageRating: 0,
              ratingsCount: 0,
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
              userRating: 0,
              averageRating: 0,
              ratingsCount: 0,
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
          // Normalize ratings so UI always has values
          list = list.map(v => {
            const avg = Number(v.averageRating)
            const user = Number(v.userRating)
            let averageRating = Number.isFinite(avg) ? avg : (Number.isFinite(user) ? user : 0)
            // Clamp to [0,5]
            if (!Number.isFinite(averageRating)) averageRating = 0
            averageRating = Math.max(0, Math.min(5, averageRating))
            let ratingsCount = Number(v.ratingsCount)
            if (!Number.isFinite(ratingsCount)) {
              const rc = Number(v?.ratings?.ratingsCount)
              ratingsCount = Number.isFinite(rc) ? rc : 0
            }
            return { ...v, averageRating, ratingsCount }
          })
          this.playlist = list
          // init seek arrays
          this.progressPercents = new Array(this.playlist.length).fill(0)
          this.bufferedPercents = new Array(this.playlist.length).fill(0)
          this.durations = new Array(this.playlist.length).fill(0)
          this.currentTimes = new Array(this.playlist.length).fill(0)
          this.$nextTick(() => {
            this.cacheVideoElements();
            this.setupHlsForIndex(0);
            this.ensureOnlyActivePlaying();
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
            userRating: 0,
            averageRating: 0,
            ratingsCount: 0,
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
            userRating: 0,
            averageRating: 0,
            ratingsCount: 0,
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
        this.$nextTick(() => {
          this.ensureOnlyActivePlaying();
          this.setupHlsForIndex(this.currentIndex);
        });
      }
    },
    prevVideo() {
      if (this.currentIndex > 0) {
        this.destroyHlsForIndex(this.currentIndex);
        this.currentIndex--;
        this.preloadAdjacentVideos();
        this.cleanupVideoCache();
        // Setup HLS for new index if available
        this.$nextTick(() => {
          this.ensureOnlyActivePlaying();
          this.setupHlsForIndex(this.currentIndex);
        });
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
      const t = event.touches[0];
      this.drawerTouchStartY = t.clientY;
      this.drawerTouchStartX = t.clientX;
      this.drawerTouchStartTime = Date.now();
      // Track which content element (if any) the user started on
      const contentEl = (event.target as Element)?.closest?.('.drawer-content');
      this.drawerActiveContentEl = contentEl as any || null;
      let inHeader = false;
      if (contentEl) {
        const headerEl = (contentEl as HTMLElement).querySelector('.drawer-header') as HTMLElement | null;
        if (headerEl) {
          const rect = headerEl.getBoundingClientRect();
          inHeader = t.clientY >= rect.top && t.clientY <= rect.bottom && t.clientX >= rect.left && t.clientX <= rect.right;
        }
      }
      const scrollTop = contentEl ? (contentEl as HTMLElement).scrollTop : 0;
      // Eligible if gesture starts on backdrop, anywhere when scrolled to top, or always on header
      this.drawerSwipeEligible = !contentEl || inHeader || scrollTop <= 0;
      this.drawerSwipeFromHeader = !!inHeader;
    },
    handleDrawerTouchMove(event) {
      if (!this.drawerTouchStartY) return;
      const t = event.touches[0];
      // If gesture started inside content and wasn't initially eligible,
      // promote to eligible once user scrolls to top and continues pulling down.
      if (!this.drawerSwipeEligible) {
        const contentEl = this.drawerActiveContentEl as HTMLElement | null;
        if (contentEl) {
          const atTop = contentEl.scrollTop <= 0;
          const deltaYProbe = t.clientY - this.drawerTouchStartY;
          const deltaXProbe = t.clientX - this.drawerTouchStartX;
          const verticalDominantProbe = Math.abs(deltaYProbe) > Math.abs(deltaXProbe) * 1.2;
          if (atTop && verticalDominantProbe && deltaYProbe > 8) {
            this.drawerSwipeEligible = true;
            this.drawerSwipeFromHeader = false;
            // Reset thresholds from the moment we reached the top for a natural feel
            this.drawerTouchStartY = t.clientY;
            this.drawerTouchStartTime = Date.now();
          }
        }
        if (!this.drawerSwipeEligible) return; // still not eligible; let content scroll normally
      }
      const deltaY = t.clientY - this.drawerTouchStartY;
      const deltaX = t.clientX - this.drawerTouchStartX;
      const verticalDominant = Math.abs(deltaY) > Math.abs(deltaX) * 1.2;
      // Reduce threshold when starting from header; prevent default scrolling when swiping on header
      const duration = Date.now() - this.drawerTouchStartTime;
      let threshold = this.drawerSwipeFromHeader ? 30 : 120;
      if (this.drawerSwipeFromHeader) {
        try { event.preventDefault(); } catch (e) {}
      }
      if (verticalDominant && deltaY > threshold) {
        this.showCommentsDrawer = false;
        this.showDescriptionDrawer = false;
        this.drawerTouchStartY = 0;
      }
    },
    handleDrawerTouchEnd() {
      this.drawerTouchStartY = 0;
      this.drawerTouchStartX = 0;
      this.drawerSwipeEligible = false;
      this.drawerSwipeFromHeader = false;
      this.drawerActiveContentEl = null;
      this.drawerTouchStartTime = 0;
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
    closeAnyDrawer() {
      this.showCommentsDrawer = false;
      this.showDescriptionDrawer = false;
    },
    async loadCommentsForCurrent(initial = false) {
      try {
        const v = this.currentVideo
        if (!v) return
        const videoId = v.hash || v.id || v.txid
        if (!videoId) return
        if (v._commentsLoading) return
        if (initial && Array.isArray(v.commentData) && v.commentData.length) return
        v._commentsOffset = v._commentsOffset || 0
        v._commentsHasMore = v._commentsHasMore !== undefined ? v._commentsHasMore : true
        if (!v._commentsHasMore && !initial) return
        v._commentsLoading = true
        this.commentsLoading = true
        const limit = this.commentsPageSize
        const offset = v._commentsOffset || 0
        const result = await bastyonApi.fetchComments(videoId, { limit, offset, includeProfiles: true, includeReplies: false, repliesLimit: 5 })
        const profiles = result?.profiles || {}
        const readScores = (obj) => {
          const raw = obj && obj.raw ? obj.raw : obj
          const up = raw?.scoreUp ?? raw?.scoreup ?? raw?.likes ?? raw?.upvotes ?? raw?.up ?? raw?.score?.up
          const down = raw?.scoreDown ?? raw?.scoredown ?? raw?.dislikes ?? raw?.downvotes ?? raw?.down ?? raw?.score?.down
          return { scoreUp: Number.isFinite(up) ? Number(up) : 0, scoreDown: Number.isFinite(down) ? Number(down) : 0 }
        }
        const mapReply = (r, ri) => {
          const rProf = r?.address ? profiles[r.address] : null
          const rName = rProf?.name || r.authorName || r.author?.name || r.user || (r.address ? (r.address.substring(0, 6) + '…' + r.address.substring(r.address.length - 4)) : 'Anonymous')
          const scores = readScores(r)
          return {
            id: r.id || r.hash || `r-${ri}-${Date.now()}`,
            user: rName,
            text: r.text || r.msg || '',
            avatar: rProf?.avatar || r.authorAvatar || r.author?.avatar,
            reputation: rProf?.reputation || r.authorReputation || r.author?.reputation,
            timestamp: r.timestamp,
            scoreUp: scores.scoreUp,
            scoreDown: scores.scoreDown,
          }
        }
        const items = (result?.comments || []).map((c, i) => {
          const prof = c.address ? profiles[c.address] : null
          const displayUser = prof?.name || c.authorName || c.author?.name || c.user || (c.address ? (c.address.substring(0, 6) + '…' + c.address.substring(c.address.length - 4)) : 'Anonymous')
          const repliesArr = Array.isArray(c.replies) ? c.replies.map((r, ri) => mapReply(r, ri)) : []
          const replyCount = Number.isFinite(c.replyCount) ? Number(c.replyCount) : (Array.isArray(repliesArr) ? repliesArr.length : 0)
          const scores = readScores(c)
          return {
            id: c.id || c.hash || `c-${offset + i}-${Date.now()}`,
            user: displayUser,
            text: c.text || c.msg || '',
            avatar: prof?.avatar || c.authorAvatar || c.author?.avatar,
            reputation: prof?.reputation || c.authorReputation || c.author?.reputation,
            timestamp: c.timestamp,
            replyCount,
            replies: repliesArr,
            showReplies: false,
            scoreUp: scores.scoreUp,
            scoreDown: scores.scoreDown,
          }
        })
        if (!Array.isArray(v.commentData)) v.commentData = []
        v.commentData = v.commentData.concat(items)
        v._commentsOffset += items.length
        const total = Number.isFinite(result?.count) ? Number(result.count) : undefined
        if (Number.isFinite(total)) {
          v.comments = total
          v._commentsHasMore = v._commentsOffset < total
        } else {
          v._commentsHasMore = items.length === limit
        }
      } catch (e) {
        console.warn('Failed to load comments:', e)
      } finally {
        this.commentsLoading = false
        if (this.currentVideo) this.currentVideo._commentsLoading = false
      }
    },
    onCommentsScroll() {
      try {
        const el = this.$refs.commentsContent
        if (!el || !this.showCommentsDrawer) return
        const threshold = 150
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
          const v = this.currentVideo
          if (!v) return
          if (v._commentsHasMore && !v._commentsLoading) {
            this.loadCommentsForCurrent(false)
          }
        }
      } catch (_) {}
    },
    // Desktop swipe support
    handleMouseDown(e) {
      if (!this.isMobile) return;
      this.mouseDown = true;
      this.mouseStartY = e.clientY;
      this.mouseStartX = e.clientX;
      this.mouseStartTime = Date.now();
    },
    handleMouseMove(e) {
      if (!this.isMobile) return;
      if (!this.mouseDown) return;
      // We can add live preview transform if desired in the future
    },
    handleMouseUp(e) {
      if (!this.isMobile) return;
      if (!this.mouseDown) return;
      const endY = e.clientY;
      const endX = e.clientX;
      const diffY = this.mouseStartY - endY;
      const diffX = this.mouseStartX - endX;
      const duration = Date.now() - this.mouseStartTime;
      const isFast = duration < 300;
      const isLong = Math.abs(diffY) > 50 || Math.abs(diffX) > 50;
      if (isFast && isLong) {
        if (Math.abs(diffY) > Math.abs(diffX)) {
          if (diffY > 0) this.nextVideo(); else this.prevVideo();
        } else {
          if (diffX > 0) this.openCameraInterface(); else this.closeCameraInterface();
        }
      }
      this.mouseDown = false;
      this.mouseStartY = 0;
      this.mouseStartX = 0;
      this.mouseStartTime = 0;
    },
    updateVideoFit(index) {
      const el = this.$refs.videoElements?.[index] || this.$refs.videoElements;
      if (!el || !el.videoWidth || !el.videoHeight) return;
      const videoAR = el.videoWidth / el.videoHeight;
      const viewportAR = (window.innerWidth || 360) / (window.innerHeight || 640);
      // If video is much wider than viewport (landscape), use contain to avoid over-cropping
      // Otherwise prefer cover for immersive experience
      const useContain = videoAR / viewportAR > 1.2; // threshold tuned for balance
      this.$set ? this.$set(this.videoFit, index, useContain ? 'contain' : 'cover') : (this.videoFit[index] = useContain ? 'contain' : 'cover');
    },
    async toggleReplies(cIdx) {
      const v = this.currentVideo
      if (!v || !Array.isArray(v.commentData)) return
      const comment = v.commentData[cIdx]
      if (!comment) return
      const opening = !comment.showReplies
      comment.showReplies = opening
      if (opening && (!Array.isArray(comment.replies) || comment.replies.length === 0)) {
        try {
          const videoId = v.hash || v.id || v.txid
          if (!videoId || !comment.id) return
          const result = await bastyonApi.fetchComments(videoId, { limit: 50, includeProfiles: true, parentid: comment.id })
          const profiles = result?.profiles || {}
          const readScores = (obj) => {
            const raw = obj && obj.raw ? obj.raw : obj
            const up = raw?.scoreUp ?? raw?.scoreup ?? raw?.likes ?? raw?.upvotes ?? raw?.up ?? raw?.score?.up
            const down = raw?.scoreDown ?? raw?.scoredown ?? raw?.dislikes ?? raw?.downvotes ?? raw?.down ?? raw?.score?.down
            return {
              scoreUp: Number.isFinite(up) ? Number(up) : 0,
              scoreDown: Number.isFinite(down) ? Number(down) : 0,
            }
          }
          const mapReply = (r, ri) => {
            const rProf = r?.address ? profiles[r.address] : null
            const rName = rProf?.name || r.authorName || r.author?.name || r.user || (r.address ? (r.address.substring(0, 6) + '…' + r.address.substring(r.address.length - 4)) : 'Anonymous')
            const scores = readScores(r)
            return {
              id: r.id || r.hash || `r-${ri}-${Date.now()}`,
              user: rName,
              text: r.text || r.msg || '',
              avatar: rProf?.avatar || r.authorAvatar || r.author?.avatar,
              reputation: rProf?.reputation || r.authorReputation || r.author?.reputation,
              timestamp: r.timestamp,
              scoreUp: scores.scoreUp,
              scoreDown: scores.scoreDown,
            }
          }
          const repliesArr = (result?.comments || []).map((r, ri) => mapReply(r, ri))
          this.$set ? this.$set(comment, 'replies', repliesArr) : (comment.replies = repliesArr)
          if (Number.isFinite(result?.count)) comment.replyCount = Number(result.count)
        } catch (e) {
          console.warn('Failed to load replies:', e)
        }
      }
    },
    replyToComment(comment) {
      // Placeholder: hook into composer when available
      console.log('Reply to:', comment)
      alert('Reply composer coming soon')
    },
    submitComment() {
      const text = (this.newComment || '').trim();
      if (!text) return;
      // Placeholder: integrate with Bastyon API when ready
      console.log('Submit comment:', text);
      alert('Comment posting coming soon');
      this.newComment = '';
    },
    selectDonate(amount) {
      this.selectedDonate = amount;
      console.log('Selected donate amount:', amount);
    },
    selectCustomDonate() {
      this.selectedDonate = 'custom';
      const v = typeof window !== 'undefined' ? window.prompt('Enter custom amount of pkoins:') : null;
      const n = Number(v);
      if (v != null && Number.isFinite(n) && n > 0) {
        this.selectedDonate = n;
      }
    },
    async toggleCommentsDrawer() {
      const opening = !this.showCommentsDrawer
      this.showCommentsDrawer = opening;
      if (opening) {
        await this.loadCommentsForCurrent(true)
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
    async addCommentLegacy() {
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
    async donateToCreatorLegacy() {
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
      // Only initialize media pipeline for the active slide
      if (index === this.currentIndex) {
        this.setupHlsForIndex(index);
      }
      console.log(`Video ${index} loaded`);
      // Keep non-active slides paused
      if (index !== this.currentIndex) {
        const el = this.$refs.videoElements?.[index] || this.$refs.videoElements;
        if (el && !el.paused) {
          try { el.pause(); } catch (_) {}
        }
        return;
      }
      // Play active slide if possible
      this.$nextTick(() => {
        const videoElement = this.$refs.videoElements?.[index];
        if (videoElement) {
          if (this.userWantsSound) {
            this.isMuted = false;
            videoElement.muted = false;
            videoElement.volume = 1.0;
          }
          videoElement.play().catch(e => console.log('Autoplay failed:', e));
        }
      });
    },
    onVideoCanPlay(index) {
      // Handle video can play event
      console.log(`Video ${index} can play`);
    },
    onVideoPlay(index) {
      // If a non-active slide starts playing, immediately pause it
      if (index !== this.currentIndex) {
        const el = this.$refs.videoElements?.[index] || this.$refs.videoElements;
        if (el) {
          try { el.pause(); } catch (_) {}
        }
        return;
      }
      console.log(`Video ${index} playing`);
      if (this.bufferingIndex === index) this.bufferingIndex = null;
      if (this.pausedOverlayIndex === index) this.pausedOverlayIndex = null;
    },
    onVideoPause(index) {
      console.log(`Video ${index} paused`);
      if (index === this.currentIndex) {
        this.pausedOverlayIndex = index;
      }
    },
  },
  mounted() {
    this.fetchVideos();
    // Ensure first video initializes HLS if available
    this.$nextTick(() => {
      this.setupHlsForIndex(this.currentIndex);
      this.ensureOnlyActivePlaying();
      // Compute initial fit for current video
      this.updateVideoFitForIndex(this.currentIndex);
    });
    // Listen to resize to recompute fit
    try {
      (this).___boundResize = () => this.onWindowResize();
      window.addEventListener('resize', (this).___boundResize, { passive: true });
      window.addEventListener('orientationchange', (this).___boundResize, { passive: true });
    } catch (_) {}
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
    // Remove listeners
    try {
      if ((this).___boundResize) {
        window.removeEventListener('resize', (this).___boundResize);
        window.removeEventListener('orientationchange', (this).___boundResize);
      }
    } catch (_) {}
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
  height: 100dvh; /* stabilize on mobile address bar hide/show */
  width: 100vw;
  background-color: var(--background-dark);
  overflow: hidden;
}

/* App loading overlay with rotating Bastyon logo */
.loading-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.85);
  color: #fff;
  z-index: 2000;
  gap: 12px;
}
.logo-spinner {
  width: 64px;
  height: 64px;
  animation: spin 1.1s linear infinite;
  user-select: none;
  -webkit-user-drag: none;
}
.logo-spinner.small { width: 36px; height: 36px; }

/* Screen tint overlay for drawers */
.screen-tint {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.0);
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: none;
  z-index: 900; /* behind drawers (1000), above video */
}
.screen-tint.visible {
  opacity: 0.6;
  background: rgba(0,0,0,0.6);
  pointer-events: auto;
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
  pointer-events: none; /* Prevent hidden slides from intercepting clicks */
  z-index: 1; /* Ensure base stacking below the active slide */
  transform: translateY(100%);
  transition: opacity 0.25s ease, transform 0.35s ease;
}

.video-slide.active {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto; /* Only the active slide should be interactive */
  z-index: 2;
}

/* Place non-active slides just above/below for smoother vertical transition */
.video-slide.above { transform: translateY(-100%); }
.video-slide.below { transform: translateY(100%); }

/* Video sizing helpers */
.video-slide video { width: 100%; height: 100%; }
.fit-cover { object-fit: cover; }
.fit-contain { object-fit: contain; background-color: #000; }

.unmute-btn {
  position: absolute;
  bottom: 90px;
  right: 16px; /* move to right to avoid avatar overlap */
  z-index: 1000; /* ensure clickable above overlays */
  padding: 8px 12px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 20px;
  font-size: 14px;
}

/* Align uploader row and follow button on one line to the left */
.video-info .account-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.video-info .uploader {
  display: flex;
  align-items: center;
  gap: 8px;
}
.video-info .follow-btn {
  margin-left: 4px;
}
.video-description p {
  margin-top: 6px;
}
.video-date-inline {
  color: #bbb;
  font-size: 12px;
  margin-left: 8px;
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
}

/* Prevent non-active videos from capturing taps */
.video-slide:not(.active) video {
  pointer-events: none;
}

/* Explicitly allow pointer events on the active video's element */
.video-slide.active video {
  pointer-events: auto;
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
.description-drawer .drawer-content > h3,
.comments-drawer .drawer-content > h3 { margin-top: 8px; }

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
  background: transparent; /* separate screen tint overlay handles the dim */
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
  background: rgba(0,0,0,0.55);
  backdrop-filter: saturate(120%) blur(10px);
  -webkit-backdrop-filter: saturate(120%) blur(10px);
  padding: 0 20px 0;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  max-height: 80%;
  overflow-y: auto;
  overscroll-behavior: contain; /* avoid scroll chaining to page */
  -webkit-overflow-scrolling: touch; /* smoother iOS scrolling */
  color: var(--text-primary);
  box-shadow: 0 -8px 24px rgba(0,0,0,0.4);
  border-top: 1px solid rgba(255,255,255,0.08);
}

.comments-drawer .drawer-content {
  max-height: 66%;
}

.drawer-content h3 {
  margin-top: 0;
  color: var(--text-primary);
}

/* Sticky header for drawers (e.g., Comments) */
.drawer-header {
  position: sticky;
  top: 0;
  z-index: 5;
  background: rgba(0,0,0,0.3);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 14px 20px 12px; /* move top spacing into header */
  margin: 0  -20px 10px;   /* stretch to edges inside drawer-content */
  border-bottom: 1px solid rgba(255,255,255,0.1);
  touch-action: none; /* prevent scroll-before-close when swiping from header */
}

/* Comments list states */
.comments-loading { display: flex; align-items: center; justify-content: center; padding: 16px 0; }
.comments-loading.more { padding: 10px 0 18px; }
.no-comments { text-align: center; color: rgba(255,255,255,0.7); padding: 16px 0; }
.drawer-header h3 { margin: 0; }

/* Sticky footer inside drawer content */
.drawer-footer {
  position: sticky;
  bottom: 0;
  z-index: 5;
  background-color: var(--background-darker);
  margin: 10px -20px 0; /* stretch edge-to-edge like header */
  padding: 10px 20px 12px;
  border-top: 1px solid rgba(255,255,255,0.1);
}
.add-comment-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.add-comment-row input[type="text"] {
  flex: 1;
  height: 36px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,0.2);
  background: var(--background-darkest);
  color: var(--text-primary);
  padding: 0 12px;
}
.send-btn {
  height: 36px;
  width: 44px;
  border-radius: 18px;
  border: none;
  background: var(--accent, #3fa3ff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.donate-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.donate-label {
  font-size: 13px;
  color: var(--text-secondary, rgba(255,255,255,0.8));
}
.donate-chip {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.25);
  color: var(--text-primary);
  border-radius: 16px;
  padding: 6px 10px;
  font-size: 13px;
}
.donate-chip.active { background: rgba(255, 215, 0, 0.15); border-color: #FFD700; }
.donate-chip.custom { border: none; outline: none; -webkit-tap-highlight-color: transparent; }
.donate-chip.custom:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(255,255,255,0.25) inset; }
/* Remove outline from Custom amount button while keeping an accessible focus style */
.donate-chip.custom { outline: none; }
.donate-chip.custom:focus { outline: none; box-shadow: 0 0 0 2px rgba(255,255,255,0.25) inset; }
/* Deep selectors in case the chip is rendered in a child component */
:deep(.donate-chip.custom),
:deep(button.donate-chip.custom),
:deep(.donate-chip.custom button),
:deep(.donate-row .custom) {
  outline: none !important;
  box-shadow: none !important;
  -webkit-tap-highlight-color: transparent;
  border: none !important;
  -webkit-appearance: none;
  appearance: none;
}

/* Extra padding at bottom so last comment isn't too tight against footer */
.comments-list { padding-bottom: 120px; }

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
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.comment:last-child {
  border-bottom: none;
}

.comments-list { text-align: left; }
.comment-content { flex: 1; }
.comment-header { display: flex; align-items: center; gap: 8px; }
.comment-author { font-weight: 600; }
.comment-text { margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; }

/* Ensure comment avatar fallback matches .usericon size in comment rows */
.comment .uploader-avatar-fallback { width: 32px; height: 32px; }

/* Show date inline within comment header */
.comment-header .comment-date { display: inline-block; margin-top: 0; }

.comment-date {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
  display: block;
}

/* Comment actions */
.comment-actions { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.action-btn { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: var(--text-primary); border-radius: 14px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
.action-btn.thumb { color: #bbb; border-color: rgba(255,255,255,0.1); }
.action-btn .count { margin-left: 6px; font-size: 12px; color: var(--text-secondary); }
.replies-toggle { margin-top: 4px; }
.toggle-replies { background: rgba(255,255,255,0.08); border: none; color: var(--text-primary); }
.replies-list { margin-top: 8px; margin-left: 40px; display: flex; flex-direction: column; gap: 10px; border-left: 1px dashed rgba(255,255,255,0.15); padding-left: 10px; }
.reply { display: flex; align-items: flex-start; gap: 10px; }

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