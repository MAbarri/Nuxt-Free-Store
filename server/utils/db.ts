import { drizzle } from 'drizzle-orm/d1'
import { createError, type H3Event } from 'h3'
import * as schema from '../database/schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

/**
 * Resolves a Drizzle ORM client bound to this request's D1 database.
 * Never cache the returned instance across requests — bindings are
 * per-request in the Workers runtime.
 */
export function useDb(event: H3Event): Db {
  const binding = event.context.cloudflare?.env?.DB
  if (!binding) {
    throw createError({ statusCode: 500, statusMessage: 'Database binding (DB) is not available' })
  }
  return drizzle(binding, { schema })
}
