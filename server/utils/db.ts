import { drizzle } from 'drizzle-orm/d1'
import { createError, type H3Event } from 'h3'
import * as schema from '../database/schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

/**
 * Resolves a Drizzle ORM client bound to this request's D1 database.
 *
 * Uses the D1 Sessions API with the `first-primary` constraint: the first
 * query of the request always hits the primary, and the rest stay
 * consistent with it. Without this, a read in one request can land on a
 * replica that hasn't yet observed a very recent write from a previous
 * request (e.g. a session row created at login) — D1's documented
 * read-replication behavior. Our traffic volume doesn't need replica
 * scaling, so we trade that for always-consistent reads.
 *
 * Never cache the returned instance across requests — bindings and
 * sessions are per-request in the Workers runtime.
 */
export function useDb(event: H3Event): Db {
  const binding = event.context.cloudflare?.env?.DB
  if (!binding) {
    throw createError({ statusCode: 500, statusMessage: 'Database binding (DB) is not available' })
  }
  return drizzle(binding.withSession('first-primary') as unknown as D1Database, { schema })
}
