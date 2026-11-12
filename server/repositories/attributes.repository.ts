import { asc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { productAttributes, productAttributeValues } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export const attributesRepository = {
  async list(event: H3Event) {
    const db = useDb(event)
    const [attrs, values] = await Promise.all([
      db.select().from(productAttributes).orderBy(asc(productAttributes.name)),
      db.select().from(productAttributeValues).orderBy(asc(productAttributeValues.sortOrder)),
    ])
    return attrs.map(attr => ({ ...attr, values: values.filter(v => v.attributeId === attr.id) }))
  },

  async findById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(productAttributes).where(eq(productAttributes.id, id)).limit(1)
    return row ?? null
  },

  async findBySlug(event: H3Event, slug: string) {
    const db = useDb(event)
    const [row] = await db.select().from(productAttributes).where(eq(productAttributes.slug, slug)).limit(1)
    return row ?? null
  },

  async create(event: H3Event, input: { name: string, slug: string, displayType: 'text' | 'select' | 'swatch' }) {
    const db = useDb(event)
    const id = generateId('attr')
    await db.insert(productAttributes).values({ id, ...input, createdAt: new Date() })
    return id
  },

  async remove(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(productAttributes).where(eq(productAttributes.id, id))
  },

  async addValue(event: H3Event, attributeId: string, input: { value: string, swatchHex?: string | null, swatchImageUrl?: string | null, sortOrder?: number }) {
    const db = useDb(event)
    const id = generateId('attrval')
    await db.insert(productAttributeValues).values({
      id,
      attributeId,
      value: input.value,
      swatchHex: input.swatchHex ?? null,
      swatchImageUrl: input.swatchImageUrl ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    return id
  },

  async removeValue(event: H3Event, valueId: string) {
    const db = useDb(event)
    await db.delete(productAttributeValues).where(eq(productAttributeValues.id, valueId))
  },
}
