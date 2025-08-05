import type { NextFunction, Request, Response } from 'express'
import createError from 'http-errors'

declare type WebError = Error & { status?: number }

export function errorHandler(err: WebError, req: Request, res: Response, next: NextFunction): void {
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  const status = err.status || 500
  const isDevelopment = req.app.get('env') === 'development'
  
  // Log errors for debugging
  console.error(`[${new Date().toISOString()}] Error ${status}:`, err.message)
  if (isDevelopment) {
    console.error('Stack trace:', err.stack)
  }

  // API-specific error responses
  if (req.path.startsWith('/api/')) {
    res.status(status).json({
      success: false,
      error: {
        message: err.message,
        status: status,
        ...(isDevelopment && { stack: err.stack })
      }
    })
  } else {
    res.status(status).json({ 
      title: err.name || 'Error', 
      message: err.message,
      status: status
    })
  }
}

export function errorNotFoundHandler(req: Request, res: Response, next: NextFunction): void {
  // API-specific 404 responses
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: {
        message: `API endpoint not found: ${req.method} ${req.path}`,
        status: 404
      }
    })
  } else {
    next(createError(404))
  }
}

// Async error wrapper for route handlers
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
