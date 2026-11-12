import { and, asc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { categories } from '../database/schema'
import { useDb } from '../utils/db'

export const storefrontCategoriesService = {
  async list(event: H3Event) {
    const db = useDb(event)
    return db.select().from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name))
  },

  async getBySlug(event: H3Event, slug: string) {
    const db = useDb(event)
    const [row] = await db.select().from(categories)
      .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
      .limit(1)
    return row ?? null
  },
}
