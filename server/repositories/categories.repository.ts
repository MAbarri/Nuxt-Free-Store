import { eq, asc } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { categories } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export interface CategoryInput {
  name: string
  slug: string
  description?: string | null
  imageUrl?: string | null
  parentId?: string | null
  isActive?: boolean
  sortOrder?: number
}

export const categoriesRepository = {
  async list(event: H3Event) {
    const db = useDb(event)
    return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
  },

  async findById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
    return row ?? null
  },

  async findBySlug(event: H3Event, slug: string) {
    const db = useDb(event)
    const [row] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1)
    return row ?? null
  },

  async create(event: H3Event, input: CategoryInput) {
    const db = useDb(event)
    const now = new Date()
    const id = generateId('cat')
    await db.insert(categories).values({
      id,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      parentId: input.parentId ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    return this.findById(event, id)
  },

  async update(event: H3Event, id: string, input: Partial<CategoryInput>) {
    const db = useDb(event)
    await db.update(categories).set({ ...input, updatedAt: new Date() }).where(eq(categories.id, id))
    return this.findById(event, id)
  },

  async remove(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(categories).where(eq(categories.id, id))
  },
}
