import { type Request, type Response, Router } from 'express'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the API' })
})

export { router as index }
