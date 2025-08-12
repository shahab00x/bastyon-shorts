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
        <button class="settings-top-right" @click.stop="openSettingsPage" aria-label="Settings">⚙</button>
        <video 
          ref="videoElements"
          :src="currentIndex === index ? resolvedSrc(index, video) : ''" 
          :muted="isMuted" 
          :autoplay="settings.autoplay"
          playsinline
          webkit-playsinline
          x5-playsinline
          crossorigin="anonymous"
          :preload="currentIndex === index ? 'auto' : 'none'"
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
        <div v-if="pausedOverlayIndex === index" class="pause-overlay">
          <button class="pause-play" @click.stop="togglePlayPause($event, index)" aria-label="Play">▶</button>
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
              @click.stop="toggleDescriptionDrawer"
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
            
            <div class="comments-icon" @click.stop="toggleCommentsDrawer">
              💬
              <span class="comments-badge">{{ video.comments || 0 }}</span>
            </div>
            
            <div class="share-btn" @click.stop="shareVideo">
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
        <!-- Hashtags only when drawer is open -->
        <div v-if="showDescriptionDrawer && descriptionTags.length" class="hashtags-row">
          <span v-for="(tag, i) in descriptionTags" :key="i" class="hashtag">{{ tag }}</span>
        </div>
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
            </div>
            <div v-else class="uploader-avatar-fallback">
              {{ (comment.user || '?').charAt(0).toUpperCase() }}
            </div>
            <div class="comment-content">
              <div class="comment-header">
                <strong class="comment-author">{{ comment.user }}</strong>
                <span class="comment-date">{{ formatDateTime(comment.timestamp) }}</span>
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
                  </div>
                  <div v-else class="uploader-avatar-fallback">
                    {{ (reply.user || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="comment-content">
                    <div class="comment-header">
                      <strong class="comment-author">{{ reply.user }}</strong>
                      <span class="comment-date">{{ formatDateTime(reply.timestamp) }}</span>
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
              id="add-comment"
              name="comment"
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
            <div class="donate-row" ref="donateRow">
              <button v-if="showDonate1" :class="['donate-chip', { active: selectedDonate === 1 }]" @click="selectDonate(1)" aria-label="Donate 1 pkoin">🪙 1</button>
              <button v-if="showDonate2" :class="['donate-chip', { active: selectedDonate === 2 }]" @click="selectDonate(2)" aria-label="Donate 2 pkoins">🪙 2</button>
              <button v-if="showDonate5" :class="['donate-chip', { active: selectedDonate === 5 }]" @click="selectDonate(5)" aria-label="Donate 5 pkoins">🪙 5</button>
              <button :class="['donate-chip', 'custom', { active: selectedDonate === 'custom' }]" @click="selectCustomDonate" aria-label="Donate custom amount">Custom amount</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Settings Page (full-screen) -->
    <div v-if="showSettingsMenu" class="settings-page" @click.self="closeSettingsPage">
      <div class="settings-content" @click.stop>
        <h3>Settings</h3>
        <div class="settings-option">
          <label for="autoplay">Autoplay Videos</label>
          <input type="checkbox" id="autoplay" v-model="settings.autoplay" @change="saveSettings">
        </div>
        <div class="settings-option">
          <label for="darkMode">Dark Mode</label>
          <input type="checkbox" id="darkMode" v-model="settings.darkMode" @change="saveSettings">
        </div>
        <div class="settings-option">
          <label for="notifications">Enable Notifications</label>
          <input type="checkbox" id="notifications" v-model="settings.notifications" @change="saveSettings">
        </div>
        <button @click="closeSettingsPage" class="close-btn">Close</button>
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
      loading: true,
      error: null,
      videoElements: [],
      hlsInstances: [],
      isMuted: true,
      settings: {
        autoplay: true,
        quality: 'auto',
        muted: true,
        videoFit: 'cover'
      },
      videoFit: [],
      showDescriptionDrawer: false,
      showCommentsDrawer: false,
      commentsLoading: false,
      commentsError: null,
      showSettingsMenu: false,
      showDownloadModal: false,
      downloadOptions: [],
      showShareModal: false,
      shareOptions: [],
      donateAmount: 1,
      customDonateAmount: '',
      showDonateInput: false,
      donateError: null,
      commentText: '',
      commentError: null,
      isDragging: false,
      isSeeking: false,
      seekStartX: 0,
      seekStartTime: 0,
      touchStartY: 0,
      touchStartTime: 0,
      isScrolling: false,
      lastTouchMove: 0,
      videoCache: new Map(),
      preloadQueue: [],
      maxPreloadedVideos: 3,
      isDesktop: false,
      settingsLoaded: false,
      drawerActiveContentEl: null as any,
      drawerTouchStartTime: 0,
      // Treat as mobile only when touch is supported
      isMobile: (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator && navigator.maxTouchPoints > 0)),
      // Mouse-based swipe support (desktop)
      mouseDown: false,
    }
  },
  methods: {
    async fetchVideos() {
      try {
        this.loading = true;
        this.error = null;
        
        // Import the cached playlist directly to avoid CORS issues
        const cachedPlaylist = await import('../public/playlists/en/latest.json').then(m => m.default);
        
        this.playlist = cachedPlaylist.map(video => ({
          ...video,
          // Convert PeerTube URLs to direct URLs for playback
          playlistUrl: this.convertPeerTubeUrl(video.url),
          description: video.description || 'No description',
          uploader: video.uploader || 'Unknown',
          uploaderAddress: video.uploaderAddress || '',
          duration: video.duration || 0,
          likes: video.likes || 0,
          comments: video.comments || 0,
          timestamp: video.timestamp || new Date().toISOString()
        }));
        
        // Ensure uploader profiles are loaded
        await this.ensureUploaderProfiles();
        
        // Preload adjacent videos
        this.preloadAdjacentVideos();
        
        this.loading = false;
        
        // Notify host that videos are loaded
        this.notifyHost('videosLoaded', { count: this.playlist.length });
        
      } catch (error) {
        console.error('Failed to load videos:', error);
        this.error = 'Failed to load videos. Please try again.';
        this.loading = false;
      }
    },
    
    convertPeerTubeUrl(peertubeUrl) {
      // Convert peertube:// URLs to https:// for direct playback
      if (peertubeUrl && peertubeUrl.startsWith('peertube://')) {
        return peertubeUrl.replace('peertube://', 'https://');
      }
      return peertubeUrl;
    },
    onVideoLoaded(index) {
      if (this.bufferingIndex === index) this.bufferingIndex = null;
      console.log(`Video ${index} loaded`);
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
          try { 
            el.pause(); 
          } catch (_) {}
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
    // Proactively notify host as soon as we mount (redundant with fetchVideos paths)
    this.notifyHost('ready', { source: 'mounted' });
    this.loadSettings();
    this.fetchVideos();
    // Ensure first video initializes HLS if available
    this.$nextTick(() => {
      this.setupHlsForIndex(this.currentIndex);
      this.ensureOnlyActivePlaying();
      // Compute initial fit for current video
      this.updateVideoFitForIndex(this.currentIndex);
      // And adjust donate chips after initial layout
      this.adjustDonateChips();
      // Fire one more time after initial layout
      this.notifyHost('ready', { source: 'mounted:nextTick' });
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

/* Pause overlay centered play icon */
.pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 84px;
  line-height: 1;
  color: rgba(255,255,255,0.92);
  text-shadow: 0 2px 12px rgba(0,0,0,0.6);
  z-index: 900; /* above video, below unmute/button UI */
  pointer-events: none; /* let underlying UI be clickable */
}

.pause-play {
  pointer-events: auto; /* clickable play button */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: rgba(0,0,0,0.35);
  color: #fff;
  font-size: 60px;
  line-height: 1;
  border: 1px solid rgba(255,255,255,0.2);
  cursor: pointer;
}

/* Buffering overlay and spinner */
.buffering-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 800;
}
.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid rgba(255,255,255,0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
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
  position: relative;
}

.video-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 950;
  padding: 16px;
}

/* Bastyon-style avatar */
.usericon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: visible;
  position: relative;
  margin-right: 8px;
  background-color: #333;
}

.rep-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: rgba(0,0,0,0.8);
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
  z-index: 950;
  background: rgba(0,0,0,0.35);
  color: #fff;
  border: none;
  border-radius: 16px;
  padding: 6px 10px;
}

.settings-page {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  z-index: 1600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.settings-content {
  width: 100%;
  max-width: 640px;
  height: 100%;
  max-height: 100%;
  overflow-y: auto;
  background: #111;
  color: #fff;
  padding: 20px;
  box-sizing: border-box;
}
.settings-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0;
}
.close-btn {
  background: #5ac8fa;
  color: #000;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
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
  z-index: 950;
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
  background: rgba(0,0,0,0.72);
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
  background: rgba(0,0,0,0.80); /* darker glass for comments */
}

.drawer-content h3 {
  margin-top: 0;
  color: var(--text-primary);
}

/* Make description drawer come higher for easier interaction */
.description-drawer .drawer-content {
  max-height: 88%;
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

/* Make the comments drawer header fully opaque to avoid content showing through while scrolling */
.comments-drawer .drawer-header {
  background: rgba(0,0,0,1);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* Comments list states */
.comments-loading { display: flex; align-items: center; justify-content: center; padding: 16px 0; }
.comments-loading.more { padding: 10px 0 18px; }
.no-comments { text-align: center; color: rgba(255,255,255,0.7); padding: 16px 0; }

/* Hashtags row in description drawer */
.hashtags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 16px;
}
.hashtag {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  color: #e8f0ff;
  font-size: 12px;
}
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