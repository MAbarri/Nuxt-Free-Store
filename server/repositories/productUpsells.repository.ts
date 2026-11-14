import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { productUpsells, products, productImages } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export const productUpsellsRepository = {
  async listForProduct(event: H3Event, productId: string) {
    const db = useDb(event)
    return db.select().from(productUpsells)
      .where(eq(productUpsells.productId, productId))
      .orderBy(asc(productUpsells.position))
  },

  async findById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(productUpsells).where(eq(productUpsells.id, id)).limit(1)
    return row ?? null
  },

  /** Used by checkout to confirm a client-supplied companion is actually a configured upsell, not an arbitrary product. */
  async exists(event: H3Event, productId: string, relatedProductId: string) {
    const db = useDb(event)
    const [row] = await db.select({ id: productUpsells.id }).from(productUpsells)
      .where(and(eq(productUpsells.productId, productId), eq(productUpsells.relatedProductId, relatedProductId)))
      .limit(1)
    return !!row
  },

  async maxPosition(event: H3Event, productId: string): Promise<number> {
    const db = useDb(event)
    const [row] = await db.select({ max: sql<number>`COALESCE(MAX(${productUpsells.position}), -1)` })
      .from(productUpsells).where(eq(productUpsells.productId, productId))
    return Number(row?.max ?? -1)
  },

  async add(event: H3Event, productId: string, relatedProductId: string) {
    const db = useDb(event)
    const id = generateId('upsell')
    const position = (await this.maxPosition(event, productId)) + 1
    await db.insert(productUpsells).values({ id, productId, relatedProductId, position, createdAt: new Date() })
    return id
  },

  async remove(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(productUpsells).where(eq(productUpsells.id, id))
  },

  async setPosition(event: H3Event, id: string, position: number) {
    const db = useDb(event)
    await db.update(productUpsells).set({ position }).where(eq(productUpsells.id, id))
  },

  /** Admin view: each upsell row plus its target product's display summary. */
  async listForAdmin(event: H3Event, productId: string) {
    const db = useDb(event)
    const rows = await this.listForProduct(event, productId)
    if (!rows.length) return []

    const relatedIds = rows.map(r => r.relatedProductId)
    const relatedProducts = await db.select().from(products)
      .where(inArray(products.id, relatedIds))
    const images = await db.select().from(productImages)
      .where(inArray(productImages.productId, relatedIds))
      .orderBy(asc(productImages.sortOrder))

    const productById = new Map(relatedProducts.map(p => [p.id, p]))
    const imageByProduct = new Map<string, string>()
    for (const img of images) {
      if (!imageByProduct.has(img.productId)) imageByProduct.set(img.productId, img.url)
    }

    return rows.map((row) => {
      const p = productById.get(row.relatedProductId)
      return {
        id: row.id,
        position: row.position,
        relatedProductId: row.relatedProductId,
        name: p?.name ?? 'Deleted product',
        slug: p?.slug ?? null,
        basePrice: p?.basePrice ?? 0,
        imageUrl: imageByProduct.get(row.relatedProductId) ?? null,
      }
    })
  },

  /** Storefront exposure: active, non-deleted companion products with a picked default variant, ordered by position. */
  async listForStorefront(event: H3Event, productId: string) {
    const db = useDb(event)
    const rows = await this.listForProduct(event, productId)
    if (!rows.length) return []

    const relatedIds = rows.map(r => r.relatedProductId)
    const activeProducts = await db.select().from(products)
      .where(and(inArray(products.id, relatedIds), eq(products.status, 'active'), isNull(products.deletedAt)))
    const images = await db.select().from(productImages)
      .where(inArray(productImages.productId, relatedIds))
      .orderBy(asc(productImages.sortOrder))

    const productById = new Map(activeProducts.map(p => [p.id, p]))
    const imageByProduct = new Map<string, string>()
    for (const img of images) {
      if (!imageByProduct.has(img.productId)) imageByProduct.set(img.productId, img.url)
    }

    return rows
      .map(row => ({ row, product: productById.get(row.relatedProductId) }))
      .filter((x): x is { row: typeof rows[number], product: NonNullable<typeof x.product> } => !!x.product)
      .map(({ row, product }) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        basePrice: product.basePrice,
        compareAtPrice: product.compareAtPrice,
        imageUrl: imageByProduct.get(product.id) ?? null,
        position: row.position,
      }))
  },
}
