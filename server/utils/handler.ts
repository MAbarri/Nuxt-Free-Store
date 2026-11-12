import { defineEventHandler, setResponseStatus, type EventHandlerRequest, type H3Event } from 'h3'

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: {
    statusCode: number
    message: string
    details?: unknown
  }
}

/**
 * Wraps a handler so every server route returns the same
 * `{ success, data }` / `{ success, error }` envelope, and so thrown
 * `createError`s are translated into a consistent JSON error body instead of
 * Nitro's default HTML/JSON error page.
 */
export function defineApiHandler<T, Request extends EventHandlerRequest = EventHandlerRequest>(
  handler: (event: H3Event<Request>) => Promise<T> | T,
) {
  return defineEventHandler<Request>(async (event) => {
    try {
      const data = await handler(event)
      return { success: true, data } satisfies ApiSuccess<T>
    }
    catch (error: any) {
      const statusCode = error?.statusCode ?? 500
      setResponseStatus(event, statusCode)
      return {
        success: false,
        error: {
          statusCode,
          message: error?.statusMessage || error?.message || 'Internal Server Error',
          details: error?.data,
        },
      } satisfies ApiError
    }
  })
}
