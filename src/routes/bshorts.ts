import { Router } from 'express'
import * as controller from '../controllers/bshorts'

export const bshorts = Router()

// GET /api/videos/bshorts - Fetch #bshorts videos
bshorts.get('/bshorts', controller.getBShorts)

// GET /api/videos/profile - Proxy getuserprofile
bshorts.get('/profile', controller.getUserProfile)

// GET /api/videos/comments - Proxy getcomments
bshorts.get('/comments', controller.getComments)

// POST /api/videos/comment - Post a comment on a video
bshorts.post('/comment', controller.postComment)

// POST /api/videos/rate - Rate a video
bshorts.post('/rate', controller.rateVideo)

// POST /api/donate - Donate PKoin to a creator
bshorts.post('/donate', controller.donatePKoin)

// POST /api/videos/upload - Upload a video
bshorts.post('/upload', controller.uploadVideo)
