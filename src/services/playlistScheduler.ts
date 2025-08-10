import path from 'node:path'
import fs from 'node:fs/promises'
import axios from 'axios'

const LANGS = ['en', 'ru', 'de', 'fr', 'ko', 'es', 'it', 'zh'] as const

type LangCode = typeof LANGS[number]

function mapItemsToClientVideos(items: any[]) {
  return items.map((item: any) => {
    const duration = Number(item?.peertube?.durationSeconds ?? 0) || 0
    const formattedDate = item?.timestamp
      ? new Date(item.timestamp * 1000).toLocaleDateString()
      : 'Unknown date'

    let tags: string[] = []
    try {
      if (typeof item?.hashtags === 'string' && item.hashtags.trim().startsWith('[')) {
        tags = JSON.parse(item.hashtags)
      }
    } catch (_e) {
      tags = []
    }

    const score = Number(item?.ratings?.score ?? 0) || 0
    const ratingsCount = Number(item?.ratings?.ratingsCount ?? 0) || 0
    const averageRatingRaw = ratingsCount > 0 ? score / ratingsCount : 1
    const averageRating = Math.max(1, Math.min(5, averageRatingRaw))

    return {
      id: item.video_hash,
      hash: item.video_hash,
      txid: item.video_hash,
      url: item.video_url, // keep peertube:// URL; client converts to direct MP4
      resolutions: [] as any[],
      uploader: item?.author?.address || item.author_address || 'Unknown',
      uploaderAddress: item.author_address,
      description: item.caption || item.description || '',
      duration,
      timestamp: item?.timestamp ? new Date(item.timestamp * 1000).toISOString() : new Date().toISOString(),
      formattedDate,
      likes: score || item?.ratings?.ratingUp || 0,
      comments: typeof item?.commentsCount === 'number' ? item.commentsCount : (typeof item?.comments === 'number' ? item.comments : 0),
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

      const payload = videos // Array expected by client

      const outDir = path.join(process.cwd(), 'public', 'playlists', lang)
      const latestPath = path.join(outDir, 'latest.json')
      await writeJsonFile(latestPath, payload)

      // Also write a timestamped snapshot
      const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 12)
      const snapshotPath = path.join(outDir, `playlist-${ts}.json`)
      await writeJsonFile(snapshotPath, payload)

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
