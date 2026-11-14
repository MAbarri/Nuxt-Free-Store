import { desc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { socialPosts } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export interface SocialPostInput {
  productId: string | null
  productName: string
  imageUrl: string | null
  platform: string
  locale: string
  promptTypeId: string
  promptTypeLabel: string
  extraNotes: string | null
  imageInstructions: string | null
  caption: string
  hashtags: string[]
  cost: number
}

export const socialPostsRepository = {
  async list(event: H3Event) {
    const db = useDb(event)
    return db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt))
  },

  async create(event: H3Event, input: SocialPostInput) {
    const db = useDb(event)
    const id = generateId('sop')
    await db.insert(socialPosts).values({
      id,
      productId: input.productId,
      productName: input.productName,
      imageUrl: input.imageUrl,
      platform: input.platform,
      locale: input.locale,
      promptTypeId: input.promptTypeId,
      promptTypeLabel: input.promptTypeLabel,
      extraNotes: input.extraNotes,
      imageInstructions: input.imageInstructions,
      caption: input.caption,
      hashtags: input.hashtags,
      cost: input.cost,
      createdAt: new Date(),
    })
    return id
  },

  async remove(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(socialPosts).where(eq(socialPosts.id, id))
  },
}
