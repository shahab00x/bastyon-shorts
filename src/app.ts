import express from 'express'
import logger from 'morgan'

import { errorHandler, errorNotFoundHandler } from './middlewares/errorHandler'

// Routes
import { index } from './routes/index'
import path from 'path'


// Create Express server
export const app = express()

// Express configuration
app.set('port', process.env.PORT || 3030)

app.use(logger('dev'))

app.use('/', index)

app.use(errorNotFoundHandler)
app.use(errorHandler)

// Serve static files from public directory
app.use(express.static('public'));
// or with absolute path
app.use(express.static(path.join(__dirname, 'public')));