import process from 'node:process'
import express from 'express'
import logger from 'morgan'
import cors from 'cors'

import { errorHandler, errorNotFoundHandler } from './middlewares/errorHandler'

// Routes
import { index } from './routes/index'
// Create Express server
export const app = express()

// Express configuration
app.set('port', process.env.PORT || 3000)

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3333',
  credentials: true,
}))

app.use(logger('dev'))

app.use('/', index)

app.use(errorNotFoundHandler)
app.use(errorHandler)
