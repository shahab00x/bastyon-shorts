import { Router } from 'express'
import * as controller from '../controllers/index'
import { asyncHandler } from '../middlewares/errorHandler'

export const index = Router()

// Basic routes
index.get('/', controller.index)
index.get('/nodeinfo', asyncHandler(controller.getNodeInfo))

// API routes for BShorts functionality
index.get('/api/videos/bshorts', asyncHandler(controller.getBShortsVideos))
index.get('/api/videos/:videoId/comments', asyncHandler(controller.getVideoComments))
index.post('/api/videos/:videoId/comments', asyncHandler(controller.postVideoComment))
index.post('/api/videos/:videoId/rate', asyncHandler(controller.rateVideo))
index.post('/api/donate', asyncHandler(controller.donatePKoin))
index.post('/api/upload', asyncHandler(controller.uploadVideo))
index.get('/api/user/profile/:address', asyncHandler(controller.getUserProfile))
