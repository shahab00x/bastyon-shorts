import path from 'node:path'
import fs from 'node:fs/promises'
import axios from 'axios'

const LANGS = ['en', 'ru', 'de', 'fr', 'ko', 'es', 'it', 'zh'] as const

type LangCode = typeof LANGS[number]

// Determine if a JSON file contains an empty array (e.g. [] or whitespace-[])
async function fileIsEmptyArray(p: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(p, 'utf-8')
    const trimmed = raw.trim()
    if (!trimmed) return true
    try {
      const parsed = JSON.parse(trimmed)
      return Array.isArray(parsed) && parsed.length === 0
    } catch {
      return trimmed === '[]'
    }
  } catch {
    return false
  }
}

// Remove any empty JSON playlist files in a directory (e.g., latest.json or playlist-*.json that are empty arrays)
async function cleanupEmptyPlaylistFiles(dir: string): Promise<void> {
  try {
    const entries: any[] = await (fs as any).readdir(dir, { withFileTypes: true })
    for (const ent of entries) {
      try {
        if (!ent.isFile()) continue
        const name = ent.name || ''
        if (!name.endsWith('.json')) continue
        const full = path.join(dir, name)
        if (await fileIsEmptyArray(full)) {
          await fs.unlink(full)
          console.warn(`[playlistScheduler] Removed empty playlist file: ${full}`)
        }
      } catch {}
    }
  } catch {}
}

function mapItemsToClientVideos(items: any[]) {
  return items.map((item: any) => {
    const duration = Number(item?.peertube?.durationSeconds ?? 0) || 0
    const formattedDate = item?.timestamp
      ? new Date(item.timestamp * 1000).toLocaleDateString()
      : 'Unknown date'

    let tags: string[] = []
    try {
      if (typeof item?.hashtags === 'string') {
        const s = item.hashtags.trim()
        if (s.startsWith('[')) {
          tags = JSON.parse(s)
        } else if (s.length) {
          tags = s.split(/\s+/).map((t: string) => t.replace(/^#/, '')).filter(Boolean)
        }
      }
    } catch (_e) {
      tags = []
    }

    const score = Number(item?.ratings?.score ?? 0) || 0
    const ratingsCount = Number(item?.ratings?.ratingsCount ?? 0) || 0
    const averageRatingRaw = ratingsCount > 0 ? score / ratingsCount : 1
    const averageRating = Math.max(1, Math.min(5, averageRatingRaw))

    const uploaderAddress = item.author_address
    const authorName = item.author_name || item?.author?.name || item?.author?.nickname || item?.author?.nick
    const uploader = authorName || uploaderAddress || 'Unknown'
    const uploaderAvatar = item.author_avatar || (item?.author?.avatar)
    const uploaderReputation = typeof item?.author_reputation === 'number'
      ? item.author_reputation
      : (typeof item?.author?.reputation === 'number' ? item.author.reputation : undefined)

    return {
      id: item.video_hash,
      hash: item.video_hash,
      txid: item.video_hash,
      url: item.video_url, // keep peertube:// URL; client converts to direct MP4
      resolutions: [] as any[],
      uploader,
      uploaderAddress,
      uploaderAvatar,
      uploaderReputation,
      description: item.caption || item.description || '',
      duration,
      timestamp: item?.timestamp ? new Date(item.timestamp * 1000).toISOString() : new Date().toISOString(),
      formattedDate,
      likes: score || item?.ratings?.ratingUp || 0,
      comments: typeof item?.comments_count === 'number'
        ? item.comments_count
        : (typeof item?.commentsCount === 'number' ? item.commentsCount : (typeof item?.comments === 'number' ? item.comments : 0)),
      ratingsCount,
      averageRating,
      userRating: averageRating,
      commentData: [] as any[],
      type: 'video',
      tags,
      language: item.language,
      hasVideo: !!item.video_url,
      videoInfo: { peertube: item.peertube },
      rawPost: item,
      bastyonPostLink: item.bastyon_post_link,
      views: undefined as number | undefined,
    }
  })
}

async function fetchPlaylistItemsForLang(lang: LangCode, minCount = 100) {
  const base = process.env.PLAYLISTS_API_BASE || 'http://localhost:4040'
  let offset = 0
  const pageSize = 100
  const acc: any[] = []

  for (let i = 0; i < 10; i++) { // cap to 1000 items
    const url = `${base}/playlists/${encodeURIComponent(lang)}?limit=${pageSize}&offset=${offset}`
    try {
      const response = await axios.get(url, { timeout: 15000 })
      const data = response.data
      let items: any[] = []
      if (Array.isArray(data)) {
        items = data
      } else if (Array.isArray(data?.items)) {
        items = data.items
      } else {
        console.warn(`[playlistScheduler] Unexpected upstream shape for ${lang} page @ offset ${offset}:`, typeof data, data && Object.keys(data))
        items = []
      }
      if (!items.length) break
      acc.push(...items)
      if (acc.length >= minCount) break
      offset += items.length
    } catch (e) {
      console.warn(`Failed to fetch playlist items for ${lang} at offset ${offset}:`, (e as any)?.message || e)
      break
    }
  }
  return acc
}

async function writeJsonFile(outPath: string, data: any) {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, JSON.stringify(data, null, 2), 'utf-8')
}

async function generatePlaylistsOnce() {
  const started = Date.now()
  console.log('[playlistScheduler] Generating playlists...')

  for (const lang of LANGS) {
    try {
      const rawItems = await fetchPlaylistItemsForLang(lang, 100)
      const videos = mapItemsToClientVideos(rawItems)

      const outDir = path.join(process.cwd(), 'public', 'playlists', lang)

      // If upstream returned zero items, do NOT overwrite latest.json; just cleanup empties
      if (!videos.length) {
        console.warn(`[playlistScheduler] ${lang}: upstream returned 0 items; skipping write. Cleaning existing empty files...`)
        await cleanupEmptyPlaylistFiles(outDir)
        continue
      }

      const payload = videos // Array expected by client

      const latestPath = path.join(outDir, 'latest.json')
      await writeJsonFile(latestPath, payload)

      // Also write a timestamped snapshot
      const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 12)
      const snapshotPath = path.join(outDir, `playlist-${ts}.json`)
      await writeJsonFile(snapshotPath, payload)

      // Clean up any lingering empty JSON files from previous runs
      await cleanupEmptyPlaylistFiles(outDir)

      console.log(`[playlistScheduler] ${lang}: wrote ${videos.length} entries -> ${latestPath}`)
      if (videos.length < 100) {
        console.warn(`[playlistScheduler] ${lang}: WARNING generated playlist has < 100 items (${videos.length}).`)
      }
    } catch (e) {
      console.error(`[playlistScheduler] Failed to generate playlist for ${lang}:`, (e as any)?.message || e)
    }
  }

  console.log(`[playlistScheduler] Done in ${Math.round((Date.now() - started) / 1000)}s`)
}

let intervalHandle: NodeJS.Timeout | null = null

export function startPlaylistScheduler() {
  if (intervalHandle) return // already started

  // Run once at startup
  generatePlaylistsOnce().catch(err => console.error('[playlistScheduler] initial run error:', err))

  // Every 10 minutes
  intervalHandle = setInterval(() => {
    generatePlaylistsOnce().catch(err => console.error('[playlistScheduler] scheduled run error:', err))
  }, 10 * 60 * 1000)

  console.log('[playlistScheduler] Scheduler started: every 10 minutes')
}
