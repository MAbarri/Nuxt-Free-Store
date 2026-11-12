import { createError, deleteCookie, getCookie, setCookie, type H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { sessions, users } from '../database/schema'
import { useDb } from './db'
import { randomToken } from './id'

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export interface AuthUser {
  id: string
  email: string
  role: 'customer' | 'admin'
  fullName: string | null
}

declare module 'h3' {
  interface H3EventContext {
    auth?: AuthUser | null
  }
}

function sessionCookieName(event: H3Event): string {
  return event.context.cloudflare?.env?.SESSION_COOKIE_NAME || 'store_session'
}

export async function createSession(event: H3Event, userId: string): Promise<string> {
  const db = useDb(event)
  const token = randomToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

  await db.insert(sessions).values({ id: token, userId, expiresAt, createdAt: now })

  setCookie(event, sessionCookieName(event), token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })

  return token
}

export async function destroySession(event: H3Event): Promise<void> {
  const name = sessionCookieName(event)
  const token = getCookie(event, name)
  if (token) {
    await useDb(event).delete(sessions).where(eq(sessions.id, token))
  }
  deleteCookie(event, name, { path: '/' })
  event.context.auth = null
}

/**
 * Resolves the authenticated user for this request by looking up the
 * session cookie in D1. Called once per request by server middleware and
 * cached on `event.context.auth`; safe to call again, it recomputes only if
 * the middleware hasn't run (e.g. in isolated unit tests).
 */
export async function getAuthUser(event: H3Event): Promise<AuthUser | null> {
  if (event.context.auth !== undefined) return event.context.auth

  const token = getCookie(event, sessionCookieName(event))
  if (!token) {
    event.context.auth = null
    return null
  }

  const db = useDb(event)
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      role: users.role,
      fullName: users.fullName,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, token))
    .limit(1)

  if (!row || row.expiresAt.getTime() < Date.now()) {
    if (row) await db.delete(sessions).where(eq(sessions.id, token))
    event.context.auth = null
    return null
  }

  const user: AuthUser = { id: row.userId, email: row.email, role: row.role, fullName: row.fullName }
  event.context.auth = user
  return user
}

export async function requireAuthUser(event: H3Event): Promise<AuthUser> {
  const user = await getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
  return user
}

export async function requireAdmin(event: H3Event): Promise<AuthUser> {
  const user = await requireAuthUser(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }
  return user
}
