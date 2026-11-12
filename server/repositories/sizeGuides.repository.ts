import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { sizeGuides } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export interface SizeGuideInput {
  title: string
  content: unknown
  categoryId?: string | null
}

export const sizeGuidesRepository = {
  async list(event: H3Event) {
    const db = useDb(event)
    return db.select().from(sizeGuides)
  },

  async findById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(sizeGuides).where(eq(sizeGuides.id, id)).limit(1)
    return row ?? null
  },

  async findByCategoryId(event: H3Event, categoryId: string) {
    const db = useDb(event)
    const [row] = await db.select().from(sizeGuides).where(eq(sizeGuides.categoryId, categoryId)).limit(1)
    return row ?? null
  },

  async create(event: H3Event, input: SizeGuideInput) {
    const db = useDb(event)
    const id = generateId('sizeg')
    const now = new Date()
    await db.insert(sizeGuides).values({
      id,
      title: input.title,
      content: input.content,
      categoryId: input.categoryId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    return id
  },

  async update(event: H3Event, id: string, input: Partial<SizeGuideInput>) {
    const db = useDb(event)
    await db.update(sizeGuides).set({ ...input, updatedAt: new Date() }).where(eq(sizeGuides.id, id))
  },

  async remove(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(sizeGuides).where(eq(sizeGuides.id, id))
  },
}
