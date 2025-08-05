import express from 'express'
import logger from 'morgan'
import path from 'path'

import { errorHandler, errorNotFoundHandler } from './middlewares/errorHandler'

// Routes
import { index } from './routes/index'

// Create Express server
export const app = express()

// Express configuration
app.set('port', process.env.PORT || 3030)

// Middleware
app.use(logger('dev'))
app.use(express.json({ limit: '50mb' })) // JSON body parser with increased limit for video uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Routes
app.use('/', index)

// Error handling
app.use(errorNotFoundHandler)
app.use(errorHandler)

// Serve static files from dist directory (client build)
app.use(express.static(path.join(__dirname, '../dist')))

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')))

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/nodeinfo')) {
    return res.status(404).json({ message: 'API endpoint not found' })
  }
  
  // Serve index.html for all other routes (SPA fallback)
  res.sendFile(path.join(__dirname, '../dist/index.html'), (err) => {
    if (err) {
      res.status(500).send('Error loading application')
    }
  })
})