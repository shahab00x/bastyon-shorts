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

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')))

// Error handling
app.use(errorNotFoundHandler)
app.use(errorHandler)
