import type { NextFunction, Request, Response } from 'express'

export interface WebError extends Error {
  status?: number
}

export function errorHandler(err: WebError, req: Request, res: Response, _next: NextFunction): void {
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}
  res.status(err.status || 500)
  res.json({ title: err.name, message: err.message })
}

export function errorNotFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: 'Not Found' })
}

export function errorHandlerWrapper(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next)
    }
    catch (error) {
      next(error)
    }
  }
}
