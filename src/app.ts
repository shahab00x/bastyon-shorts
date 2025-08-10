import path from 'node:path'
import cors from 'cors'
import express from 'express'
import logger from 'morgan'

import { errorHandler, errorNotFoundHandler } from './middlewares/errorHandler'

// Routes
import { bshorts } from './routes/bshorts'
import { index } from './routes/index'

// Create Express server
export const app = express()

// Express configuration
app.set('port', process.env.PORT || 3030)

// Middleware
app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

// API Routes
app.use('/', index)
app.use('/api/videos', bshorts)

// Serve static files from the project's root-level public directory
const publicRoot = path.resolve(process.cwd(), 'public')
app.use(
  '/playlists',
  express.static(path.join(publicRoot, 'playlists'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.json')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')
      }
    },
  })
)
app.use(express.static(publicRoot))

// Error handling
app.use(errorNotFoundHandler)
app.use(errorHandler)
