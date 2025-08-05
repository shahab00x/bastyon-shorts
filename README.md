# BShorts - Bastyon Mini-App
## TikTok/YouTube Shorts Style Video Client for Bastyon

<p align='center'>
  <img src='./logo.png' alt='BShorts' width='200'/>
</p>

<h6 align='center'>
<a href="https://github.com/DaniilKimlb/bastyon-miniapp-expressjs-template">GitHub Repository</a>
</h6>

<h5 align='center'>
<b>A Vertical Video Client for Bastyon's #bshorts Content</b>
</h5>

## Overview

**BShorts** is a Bastyon Mini-App that provides a TikTok/YouTube Shorts-style interface for consuming short-form video content from the Bastyon network. The app focuses on videos tagged with `#bshorts` and provides an immersive, mobile-first viewing experience with vertical navigation, social interactions, and content creation capabilities.

### Current Implementation Status

✅ **Completed Features:**
- Full Vue 3 client-side application with dark theme
- Portrait mode video player with auto-play functionality
- Vertical swipe navigation (up/down for next/previous videos)
- Touch gesture handling for video navigation and camera interface
- Star rating system (1-5 stars with expansion/collapse animation)
- Comments system with vertical drawer interface
- Video description drawer with truncation
- Settings menu with customizable options
- Camera interface placeholder for content creation
- Video caching and preloading for smooth playback
- Bastyon manifest configuration with proper permissions
- Express.js server with TypeScript and PocketNetProxy integration
- Client-server API proxy configuration

⚠️ **Partially Implemented:**
- Server-side API endpoints (structure exists, implementation needed)
- Bastyon API integration (setup complete, actual calls needed)
- Content filtering (client-side filtering implemented, server-side needed)

❌ **Missing/Mock Implementation:**
- Real Bastyon #bshorts content fetching
- Actual camera recording and video upload
- PKoin donation integration
- Real-time comment posting to Bastyon
- User authentication via Bastyon SDK
- Video duration filtering on server-side

## Architecture

### Client-Server Architecture
```
┌─────────────────┐    HTTP/API     ┌──────────────────┐    RPC Calls    ┌─────────────────┐
│   Vue 3 Client  │ ──────────────► │  Express Server  │ ──────────────► │ Bastyon Network │
│   (Port 3333)   │                 │   (Port 3030)    │                 │  (PocketNet)    │
└─────────────────┘                 └──────────────────┘                 └─────────────────┘
```

### Technology Stack

**Frontend (Client):**
- Vue 3 (Composition API ready)
- Vite (Development server and build tool)
- Custom CSS with CSS Variables (Dark theme)
- Touch gesture handling (native implementation)

**Backend (Server):**
- Express.js with TypeScript
- PocketNet Proxy API integration
- Morgan logger
- Error handling middleware

**Bastyon Integration:**
- PocketNetProxyApi for server-side RPC calls
- Bastyon Mini-App manifest (`b_manifest.json`)
- Required permissions: account, messaging, payment, sign, mobilecamera

## Project Structure

```
bastyon-miniapp/
├── client/                          # Vue 3 Frontend
│   ├── public/
│   │   ├── b_manifest.json         # Bastyon Mini-App manifest
│   │   └── b_icon.png              # App icon (512x512)
│   ├── src/
│   │   ├── components/
│   │   │   └── VideoPlayer.vue     # Main video player component
│   │   ├── services/
│   │   │   └── bastyonApi.js       # API service layer
│   │   ├── App.vue                 # Root component
│   │   └── main.js                 # App initialization
│   ├── vite.config.js              # Vite configuration with proxy
│   └── package.json
├── src/                            # Express.js Backend
│   ├── controllers/
│   │   └── index.ts                # Route controllers
│   ├── lib/
│   │   └── pocketNetProxyInstance.ts # PocketNet API singleton
│   ├── middlewares/
│   │   └── errorHandler.ts         # Error handling
│   ├── routes/
│   │   └── index.ts                # API routes
│   ├── app.ts                      # Express app configuration
│   └── server.ts                   # Server startup
├── types/                          # TypeScript definitions
├── package.json                    # Root dependencies
└── README.md
```

## Features Documentation

### Core Video Player

The main video player (`VideoPlayer.vue`) implements:

- **Auto-playing Videos**: Portrait mode videos with automatic playback
- **Vertical Navigation**: Swipe up/down for next/previous video
- **Horizontal Navigation**: Swipe left to open camera interface
- **Video Caching**: Intelligent preloading of adjacent videos
- **Touch Gesture Recognition**: Native touch handling with debouncing

### User Interface Components

#### Bottom Section
- **Account Information**: Displays video uploader name
- **Follow Button**: Social interaction (placeholder)
- **Video Description**: Truncated text with tap-to-expand drawer

#### Right Side Panel
- **Settings Menu**: Customizable app preferences
- **Star Rating System**: 
  - Single star display by default
  - Expands to 5-star selector on tap
  - Animated feedback on selection
- **Comments Icon**: Opens 2/3 screen drawer with existing comments
- **Share Button**: Web Share API integration with fallback

#### Drawer Interfaces
- **Description Drawer**: Vertical, mostly opaque, scrollable
- **Comments Drawer**: 2/3 screen coverage with comment management
- **Camera Interface**: Full-screen overlay for content creation

### Settings & Customization

Available settings (persisted to localStorage):
- **Autoplay**: Toggle automatic video playback
- **Dark Mode**: Theme preference (currently locked to dark)
- **Notifications**: Enable/disable app notifications

### API Integration

#### Client-Side Service (`bastyonApi.js`)

The API service provides methods for:
```javascript
// Fetch #bshorts videos with duration filtering
fetchBShorts()

// Post comments to videos
postComment(videoId, commentText, userAddress)

// Donate PKoin to creators
donatePKoin(creatorAddress, amount)

// Rate videos (1-5 stars)
rateVideo(videoId, rating)

// Upload videos to Bastyon
uploadVideo(videoData)
```

**Current Status**: All methods return mock data with realistic API call simulation.

#### Server-Side Implementation

**PocketNetProxy Integration**:
```typescript
// Singleton instance for Bastyon network communication
const pocketNetProxyInstance = await PocketNetProxyApi.create()

// Available for RPC method calls
await pocketNetProxyInstance.rpc.getnodeinfo()
```

**Available Endpoints**:
- `GET /` - Welcome message
- `GET /nodeinfo` - Bastyon node information

**Missing Endpoints** (Implementation Needed):
- `GET /api/videos/bshorts` - Fetch #bshorts content
- `POST /api/videos/:id/comments` - Post comments
- `POST /api/videos/:id/rate` - Rate videos
- `POST /api/donate` - PKoin donations
- `POST /api/upload` - Video uploads

## Installation & Setup

### Prerequisites
- Node.js (v14+)
- pnpm (recommended) or npm
- Git

### Development Setup

1. **Clone the repository:**
```bash
git clone https://github.com/DaniilKimlb/bastyon-miniapp-expressjs-template.git
cd bastyon-miniapp-expressjs-template
```

2. **Install dependencies:**
```bash
pnpm install
```

3. **Build the server:**
```bash
pnpm build
```

4. **Start development servers:**

Terminal 1 (Server):
```bash
pnpm serve
# Server runs on http://localhost:3030
```

Terminal 2 (Client):
```bash
cd client
pnpm dev
# Client runs on http://localhost:3333
```

### Production Build

```bash
# Build server
pnpm build

# Build client
cd client
pnpm build

# Start production server
pnpm serve
```

The client build outputs to `/workspace/dist` and is served by the Express server.

## Configuration

### Bastyon Mini-App Manifest

```json
{
  "id": "bshorts.bastyon.ir",
  "name": "BShorts",
  "description": "Short video player for Bastyon #bshorts content",
  "author": "PXN76kJG5sCGTwMpRfXH5oqkDzJQKNsYk4",
  "scope": "bshorts.bastyon.ir",
  "permissions": [
    "account",      // User authentication
    "messaging",    // Comment posting
    "payment",      // PKoin donations
    "sign",         // Transaction signing
    "mobilecamera"  // Camera access
  ]
}
```

### API Proxy Configuration

The Vite development server proxies API requests:
```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3030',
      changeOrigin: true,
      secure: false
    }
  }
}
```

## Development Roadmap

### Phase 1: Core API Implementation
- [ ] Implement server-side Bastyon content fetching
- [ ] Add #bshorts hashtag filtering
- [ ] Implement duration-based video filtering (< 2 minutes)
- [ ] Create real API endpoints for comments and ratings

### Phase 2: Bastyon SDK Integration
- [ ] Implement user authentication
- [ ] Real comment posting to Bastyon network
- [ ] PKoin donation functionality
- [ ] Video upload to Bastyon with #bshorts tag

### Phase 3: Enhanced Features
- [ ] Camera recording implementation
- [ ] Video editing capabilities
- [ ] Enhanced video player controls
- [ ] Follow/unfollow functionality
- [ ] Push notifications

### Phase 4: Performance & Polish
- [ ] Implement proper video streaming
- [ ] Add advanced caching strategies
- [ ] Performance optimizations
- [ ] Error handling improvements
- [ ] Accessibility enhancements

## API Documentation

### Expected Server Endpoints

#### GET /api/videos/bshorts
Fetch videos with #bshorts hashtag and duration < 2 minutes.

**Response:**
```json
{
  "videos": [
    {
      "id": "string",
      "url": "string",
      "uploader": "string",
      "uploaderAddress": "string",
      "description": "string",
      "duration": "number",
      "timestamp": "string",
      "likes": "number",
      "comments": "array"
    }
  ]
}
```

#### POST /api/videos/:id/comments
Post a comment on a video.

**Request Body:**
```json
{
  "text": "string",
  "userAddress": "string"
}
```

#### POST /api/videos/:id/rate
Rate a video (1-5 stars).

**Request Body:**
```json
{
  "rating": "number"
}
```

#### POST /api/donate
Donate PKoin to a creator.

**Request Body:**
```json
{
  "creatorAddress": "string",
  "amount": "number"
}
```

## Contributing

### Code Style
- TypeScript for server-side code
- Vue 3 Composition API preferred for new components
- ESLint configuration provided
- Conventional commit messages

### Testing
```bash
# Run server tests
pnpm test

# Run with coverage
pnpm test --coverage
```

### Debugging
```bash
# Debug mode with inspector
pnpm debug
```

## Known Issues

1. **Mock Data Only**: All client-side API calls return mock data
2. **Missing Server Implementation**: Core Bastyon API integration not implemented
3. **Camera Placeholder**: Video recording/upload is placeholder functionality
4. **No Authentication**: User authentication via Bastyon SDK not implemented
5. **Performance**: Video loading could be optimized with streaming

## Dependencies

### Server Dependencies
- `express`: Web framework
- `pocketnet-proxy-api`: Bastyon network integration
- `pocketnet.proxy`: Additional proxy utilities
- `morgan`: HTTP request logger
- `typescript`: Type safety

### Client Dependencies
- `vue`: Frontend framework
- `vite`: Build tool and dev server

### Recommended Additions
- `axios`: HTTP client for API calls
- `swiper`: Advanced touch gestures
- `video.js`: Enhanced video player
- `tailwindcss`: Utility-first CSS framework

## License

This project is licensed under the Apache-2.0 License. See the [LICENSE](./LICENSE) file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the [PocketNet Proxy API Documentation](https://github.com/DaniilKimlb/pocketnet-proxy-api/blob/master/README.md)
- Review Bastyon Mini-App development guidelines

---

**Note**: This is a development version with mock data implementation. Production deployment requires completing the server-side Bastyon API integration.
