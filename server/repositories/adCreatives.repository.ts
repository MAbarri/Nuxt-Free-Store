import { desc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { adCreatives } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export interface AdCreativeInput {
  productId: string | null
  productName: string
  imageUrl: string | null
  platform: string
  locale: string
  designTypeId: string
  designTypeLabel: string
  extraNotes: string | null
  imageInstructions: string | null
  headline: string
  primaryText: string
  description: string | null
  ctaLabel: string
  badgeText: string | null
  cost: number
}

export const adCreativesRepository = {
  async list(event: H3Event) {
    const db = useDb(event)
    return db.select().from(adCreatives).orderBy(desc(adCreatives.createdAt))
  },

  async create(event: H3Event, input: AdCreativeInput) {
    const db = useDb(event)
    const id = generateId('adc')
    await db.insert(adCreatives).values({
      id,
      productId: input.productId,
      productName: input.productName,
      imageUrl: input.imageUrl,
      platform: input.platform,
      locale: input.locale,
      designTypeId: input.designTypeId,
      designTypeLabel: input.designTypeLabel,
      extraNotes: input.extraNotes,
      imageInstructions: input.imageInstructions,
      headline: input.headline,
      primaryText: input.primaryText,
      description: input.description,
      ctaLabel: input.ctaLabel,
      badgeText: input.badgeText,
      cost: input.cost,
      createdAt: new Date(),
    })
    return id
  },

  async remove(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(adCreatives).where(eq(adCreatives.id, id))
  },
}
