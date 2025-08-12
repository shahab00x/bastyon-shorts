# Bastyon Shorts Internals

A concise but complete guide to the Bastyon Shorts app architecture, data flow, and key code paths so a new developer can understand and rebuild the app piece by piece.

This project is a small monorepo: an Express.js backend written in TypeScript and a Vue 3 + Vite client.

- Root project path: `4-bastyon-shorts/`
- Client app: `client/`
- Server app: `src/` (TypeScript) compiled to `dist/`

---

## High-level Architecture

- __Client (`client/`)__
  - Vue 3 SPA bootstrapped by Vite.
  - Main UI lives in `client/src/components/VideoPlayer.vue`.
  - Uses `hls.js` to play HLS master playlists for PeerTube videos.
  - Fetches playlists and short video data from the backend via `client/src/services/bastyonApi.js`.
  - Handles swipe navigation, comments drawer, rating UI, and donations UI.

- __Server (`src/`)__
  - Express app defined in `src/app.ts`.
  - Routes in `src/routes/` proxy to controller logic in `src/controllers/`.
  - Primary feature endpoints are under `src/routes/bshorts.ts` with controller logic in `src/controllers/bshorts.ts`.
  - Serves static `public/` assets (including compiled playlists) and exposes `/playlists` with no-store caching for JSON.

- __Communication__
  - The client calls backend endpoints prefixed with `/api`. In dev, Vite proxies `/api` and `/playlists` to the server on port 3030 (see `client/vite.config.js`).

---

## Repository Layout

- `package.json` (root): server build/run scripts, TypeScript and dev tooling.
- `pnpm-workspace.yaml`: declares workspaces `.` and `client`.
- `src/app.ts`: Express app wiring (middleware, routes, static serving).
- `src/routes/bshorts.ts`: API endpoints related to shorts.
- `src/controllers/bshorts.ts`: Implementation of shorts endpoints.
- `src/routes/index.ts`: health/info endpoints (e.g., `/nodeinfo`).
- `src/middlewares/errorHandler.ts`: error and 404 handlers.
- `src/lib/`: backend helpers, e.g., `getPocketNetProxyInstance`.
- `public/`: static files (served by the server). Includes `public/playlists/<lang>/latest.json` for static playlist fallback.
- `client/`: Vite + Vue 3 app.
  - `client/package.json`: client scripts and deps.
  - `client/vite.config.js`: dev server proxy and build options.
  - `client/index.html`: app entry. Loads Bastyon Mini-Apps SDK if embedded.
  - `client/src/main.js`: bootstraps Vue app (imports `App.vue`).
  - `client/src/components/VideoPlayer.vue`: the primary UI and playback logic.
  - `client/src/services/bastyonApi.js`: client HTTP wrapper for backend routes.
  - `client/src/services/miniAppMessaging.js`: optional iframe messaging helper when embedded.
  - `client/public/b_manifest.json`: mini-app manifest.

Note: `main.js` references `client/src/App.vue`. Ensure the root component exists and renders `VideoPlayer.vue`.

---

## Backend: Express App

### Server wiring: `src/app.ts`
- Configures Express with `morgan` logging, `cors`, JSON parsers.
- Mounts routers:
  - `app.use('/', index)`
  - `app.use('/api/videos', bshorts)`
- Serves static files from project `public/`.
- Special static route `/playlists` serves `public/playlists/...` with `Cache-Control: no-store` for JSON.
- Error handling via `errorNotFoundHandler` and `errorHandler`.

### Routes: `src/routes/bshorts.ts`
- `GET /api/videos/bshorts` → `controller.getBShorts`
- `GET /api/videos/profile` → `controller.getUserProfile`
- `GET /api/videos/comments` → `controller.getComments`
- `POST /api/videos/comment` → `controller.postComment`
- `POST /api/videos/rate` → `controller.rateVideo`
- `POST /api/videos/donate` → `controller.donatePKoin`
- `POST /api/videos/upload` → `controller.uploadVideo`

### Controller: `src/controllers/bshorts.ts`
Key responsibilities inside `getBShorts()`:
- Fetch short videos from upstream playlists service:
  - `const base = process.env.PLAYLISTS_API_BASE || 'http://localhost:4040'`
  - Calls `${base}/playlists/:lang?limit&offset`.
- Fallback to static file if upstream fails: `public/playlists/<lang>/latest.json`.
- Dedupe items by `video_hash`.
- Map items to a canonical video model with fields such as:
  - `hash`/`id`/`txid`, `url` (peertube://...), `videoInfo.peertube.hlsUrl`, `uploader`, `uploaderAddress`, `description`, `duration`, `formattedDate`, `likes`, `comments`, `ratingsCount`, `averageRating`, `tags`, `language`, `hasVideo`, `commentData` (initial sample), `views`.
- Enrich profiles via Bastyon RPC `getuserprofile` using `getPocketNetProxyInstance()`.
- Best-effort comments enrichment (`getcomments`) for a small subset of videos.
- Best-effort PeerTube view counts by calling `https://{host}/api/v1/videos/{id}` when `url` is `peertube://...`.
- Utility functions:
  - `parsePeerTubeUrl()` parses `peertube://host/uuid`.
  - Normalization helpers for display name and avatar URLs.
  - Placeholders for future algorithms: `compilePlaylistByHashtags`, `advancedVideoFilter`, `recommendVideos`.

Other endpoints proxy to RPC methods for profiles, comments, rating, donation, and uploads.

---

## Client: Vue + HLS.js

### Vite configuration: `client/vite.config.js`
- Dev server on port `3333`.
- Proxies:
  - `/api` → `http://localhost:3030`
  - `/playlists` → `http://localhost:3030`
- Builds into `../dist`.

### API service: `client/src/services/bastyonApi.js`
- `API_BASE_URL`: defaults to `/api`; can be overridden with `VITE_API_BASE_URL`.
- Methods:
  - `fetchPlaylist(lang)` → `/playlists/:lang/latest.json` (no-store cached).
  - `fetchBShorts(lang, { limit, offset })` → `/api/videos/bshorts`.
  - `fetchProfile(address)` and `fetchProfiles(addresses)` → `/api/videos/profile`.
  - `fetchComments(hash, { ... })` → `/api/videos/comments`.
  - `postComment(videoId, commentText, userAddress)` → `/api/videos/comment`.
  - `donatePKoin(creatorAddress, amount, userAddress)` → `/api/videos/donate`.
  - `rateVideo(videoId, rating, userAddress)` → `/api/videos/rate`.
  - `uploadVideo(videoData)` → `/api/videos/upload`.

### Main UI: `client/src/components/VideoPlayer.vue`
Core responsibilities:
- Fetch and render the playlist of short videos (`fetchVideos()` uses `bastyonApi.fetchBShorts`).
- Swipe navigation (touch and mouse), play/pause tap, seekbar, overlays.
- Comments drawer with add-comment footer; donations UI with responsive chips.
- Compact rating UI (single star expands to choose 1–5 stars).
- Uploader avatar/name/reputation rendering and client-side profile enrichment when needed.

PeerTube playback flow:
- PeerTube links in data are `peertube://host/uuid`.
- `getVideoSource(url)` converts PeerTube URI to an HLS master playlist: `https://{host}/download/streaming-playlists/hls/{uuid}/master.m3u8`.
- `shouldUseHlsJs()` chooses hls.js when native HLS is unavailable.
- `resolvedSrc()` binds `src` for native HLS (Safari); returns empty string when hls.js will attach to avoid race conditions.
- `setupHlsForIndex(index)` initializes `Hls` player, handles buffering, and has a single-attempt static fallback to `/static/...` path if a 404 occurs on the manifest (only if URL matches that pattern).
- For non-PeerTube URLs, native `src` is allowed; for PeerTube URLs, direct MP4 is avoided to prevent CORS/CORB issues.

Other notable UI/logic details:
- Dedupe by hash/id to avoid duplicates.
- Auto-compute `fit-cover` vs `fit-contain` based on video dimensions to maintain best visual cropping.
- Don’t autoplay with sound unless user indicates preference; iOS/Chromium policies are handled by muting when required.
- Initial comments may be pre-populated by the server for the first N videos; further loading can use `bastyonApi.fetchComments()` if desired.

### Mini-app embedding: `client/src/services/miniAppMessaging.js`
- Optional helper for iframe integration with Bastyon host using `postMessage`.
- Strict origin allowlist via `VITE_BASTYON_ORIGINS` (comma-separated origins).
- Provides `createMiniAppMessenger({ allowedOrigins })` which returns `{ isEmbedded, request, on, off, dispose }`.

### Mini-app manifest: `client/public/b_manifest.json`
- Defines app metadata (id/name/version), `start_url`, and permissions (e.g., `account`, `messaging`, `payment`, `sign`, `mobilecamera`).

---

## Data Model (canonical video object)
Produced by the backend in `getBShorts()`; typical shape:

```jsonc
{
  "id": "<txid>",
  "hash": "<txid>",
  "txid": "<txid>",
  "url": "peertube://<host>/<uuid>",
  "videoInfo": { "peertube": { "hlsUrl": "https://<host>/.../master.m3u8" } },
  "uploader": "<name or address>",
  "uploaderAddress": "<address>",
  "uploaderAvatar": "https://...", // optional
  "uploaderReputation": 12345,      // optional
  "description": "...",
  "duration": 57,
  "timestamp": "2024-06-12T12:34:56.000Z",
  "formattedDate": "6/12/2024",
  "likes": 10,
  "comments": 3,
  "ratingsCount": 8,
  "averageRating": 4.2,
  "userRating": 4,                  // client-side chosen
  "tags": ["bshorts","news"],
  "language": "en",
  "hasVideo": true,
  "commentData": [ /* lightweight comments (best-effort) */ ],
  "views": 1200                      // PeerTube best-effort
}
```

---

## Build and Run (Dev)

Prereqs: Node.js, pnpm.

- __Install deps (root and client)__
  - `pnpm install` (from project root)

- __Run server (port 3030)__
  - One-off: `pnpm build-ts && pnpm serve`
  - Dev watch (recommended): `pnpm watch` (concurrently compiles TS and restarts server)

- __Run client (port 3333)__
  - From `client/`: `pnpm dev`
  - Vite proxies `/api` and `/playlists` to the server on `http://localhost:3030`

Open `http://localhost:3333` to load the client. The client fetches data from the server via the proxied routes.

---

## Environment and Configuration

- __Server__
  - `PORT` (default `3030`).
  - `PLAYLISTS_API_BASE`: base URL for upstream playlists (e.g., `https://example.com`). If unset or failing, the server falls back to `public/playlists/<lang>/latest.json`.

- __Client__
  - `VITE_API_BASE_URL` (optional): overrides default `/api` when embedded or deployed behind different origins.
  - `VITE_BASTYON_ORIGINS` (optional): comma-separated allowlist of host origins for `miniAppMessaging`.

---

## Playlists and Languages

The server will attempt upstream fetch first, then fallback to a static file. To supply a static playlist:

- Place JSON at: `public/playlists/<lang>/latest.json`.
- JSON formats accepted:
  - Array of items `[ ... ]`.
  - Object with `items: [ ... ]`.
- Each item typically includes: `video_hash`, `video_url` (PeerTube URI), author info, ratings, hashtags, etc.

---

## UX Guidelines and Preferences

- __Comments drawer header opacity__: The comments drawer header should have a fully opaque background (no blur) to avoid text bleed-through while scrolling.

---

## Known Pitfalls and Notes

- __PeerTube playback__: Always prefer HLS master playlists; avoid direct MP4 due to CORS/CORB. Safari supports native HLS; other browsers use `hls.js`.
- __Embedded mode__: If the app is loaded in an iframe on Bastyon, set `VITE_API_BASE_URL` to ensure requests hit your backend and configure `VITE_BASTYON_ORIGINS` for messaging.
- __CORS__: Server enables broad CORS in dev. Tighten CORS and security headers for production deployments.
- __Profile and comments enrichment__: Enrichment is best-effort. RPC payload shapes may vary; code includes multiple fallback strategies.

---

## Extensibility Hooks

The backend includes placeholders for future functionality:
- `compilePlaylistByHashtags(hashtags, maxDuration, limit)`
- `advancedVideoFilter(videos, criteria)`
- `recommendVideos(userAddress, preferences, limit)`

You can gradually implement these to add discovery, filtering, and personalization.

---

## How Things Work Together (Data Flow)

1. Client starts (Vite dev server or built files) and mounts the Vue app.
2. `VideoPlayer.vue` calls `bastyonApi.fetchBShorts(lang, { limit, offset })`.
3. Server `GET /api/videos/bshorts`:
   - Fetches upstream playlist or static fallback.
   - Normalizes and enriches items.
   - Returns an array of canonical video objects.
4. Client renders the playlist. For each visible PeerTube video:
   - Converts `peertube://host/uuid` to HLS master URL.
   - Uses native HLS (Safari) or `hls.js` (other browsers) to play.
5. Comments drawer shows initial `commentData` (if present). Posting a comment uses `POST /api/videos/comment`.
6. Profile avatars/names may be further enriched on the client for missing addresses via `fetchProfiles`/`fetchProfile`.

---

## Deployment Notes (summary)

- Build server: `pnpm build-ts` → outputs to `dist/`.
- Build client: `pnpm --filter client build` → outputs to `client/dist`, configured to `../dist` so assets land adjacent to server dist (verify your hosting layout).
- Serve: `node dist/server.js` behind a reverse proxy. Ensure CORS and proxy paths are configured.

---

## References (Key Files)

- Server: `src/app.ts`, `src/routes/bshorts.ts`, `src/controllers/bshorts.ts`, `src/middlewares/errorHandler.ts`, `src/lib/`.
- Client: `client/src/components/VideoPlayer.vue`, `client/src/services/bastyonApi.js`, `client/vite.config.js`, `client/index.html`, `client/public/b_manifest.json`.

If anything becomes out-of-date, search within these files first and update this document accordingly.
