import { deleteCookie, getCookie, setCookie, type H3Event } from 'h3'
import { randomToken } from './id'

const GUEST_COOKIE = 'guest_id'
const GUEST_TTL_SECONDS = 60 * 60 * 24 * 365 // 1 year

declare module 'h3' {
  interface H3EventContext {
    guestToken?: string
  }
}

/**
 * Anonymous visitor identity, shared by the guest cart and guest wishlist.
 *
 * Cached on `event.context` because a cookie set via `setCookie` only takes
 * effect on the *next* request — `getCookie` can't see it within the same
 * request/response cycle. Without this cache, creating a guest cart and
 * then immediately re-reading it later in the same handler would look like
 * the cart doesn't exist.
 */
export function getGuestToken(event: H3Event): string | null {
  if (event.context.guestToken) return event.context.guestToken
  const fromCookie = getCookie(event, GUEST_COOKIE) ?? null
  if (fromCookie) event.context.guestToken = fromCookie
  return fromCookie
}

export function getOrCreateGuestToken(event: H3Event): string {
  const existing = getGuestToken(event)
  if (existing) return existing

  const token = randomToken(16)
  event.context.guestToken = token
  setCookie(event, GUEST_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_TTL_SECONDS,
  })
  return token
}

export function clearGuestToken(event: H3Event): void {
  event.context.guestToken = undefined
  deleteCookie(event, GUEST_COOKIE, { path: '/' })
}
