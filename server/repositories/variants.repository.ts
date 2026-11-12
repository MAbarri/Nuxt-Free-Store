import { asc, eq, inArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { productVariants, variantAttributeValues, productAttributeValues, productAttributes } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export interface VariantInput {
  sku: string
  price?: number | null
  stock?: number
  imageUrl?: string | null
  isActive?: boolean
  attributeValueIds?: string[]
}

export const variantsRepository = {
  async listByProduct(event: H3Event, productId: string) {
    const db = useDb(event)
    const variantRows = await db.select().from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(asc(productVariants.createdAt))

    if (!variantRows.length) return []

    const variantIds = variantRows.map(v => v.id)
    const valueRows = await db.select({
      variantId: variantAttributeValues.variantId,
      valueId: productAttributeValues.id,
      value: productAttributeValues.value,
      swatchHex: productAttributeValues.swatchHex,
      swatchImageUrl: productAttributeValues.swatchImageUrl,
      attributeId: productAttributes.id,
      attributeName: productAttributes.name,
      displayType: productAttributes.displayType,
    })
      .from(variantAttributeValues)
      .innerJoin(productAttributeValues, eq(productAttributeValues.id, variantAttributeValues.attributeValueId))
      .innerJoin(productAttributes, eq(productAttributes.id, productAttributeValues.attributeId))
      .where(inArray(variantAttributeValues.variantId, variantIds))

    return variantRows.map(variant => ({
      ...variant,
      attributes: valueRows.filter(v => v.variantId === variant.id),
    }))
  },

  async findById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(productVariants).where(eq(productVariants.id, id)).limit(1)
    return row ?? null
  },

  async findBySku(event: H3Event, sku: string) {
    const db = useDb(event)
    const [row] = await db.select().from(productVariants).where(eq(productVariants.sku, sku)).limit(1)
    return row ?? null
  },

  async create(event: H3Event, productId: string, input: VariantInput) {
    const db = useDb(event)
    const id = generateId('vrt')
    const now = new Date()
    await db.insert(productVariants).values({
      id,
      productId,
      sku: input.sku,
      price: input.price ?? null,
      stock: input.stock ?? 0,
      imageUrl: input.imageUrl ?? null,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    if (input.attributeValueIds?.length) {
      await db.insert(variantAttributeValues).values(
        input.attributeValueIds.map(attributeValueId => ({ variantId: id, attributeValueId })),
      )
    }
    return id
  },

  async update(event: H3Event, id: string, input: Partial<VariantInput>) {
    const db = useDb(event)
    const { attributeValueIds, ...fields } = input
    if (Object.keys(fields).length) {
      await db.update(productVariants).set({ ...fields, updatedAt: new Date() }).where(eq(productVariants.id, id))
    }
    if (attributeValueIds) {
      await db.delete(variantAttributeValues).where(eq(variantAttributeValues.variantId, id))
      if (attributeValueIds.length) {
        await db.insert(variantAttributeValues).values(
          attributeValueIds.map(attributeValueId => ({ variantId: id, attributeValueId })),
        )
      }
    }
  },

  async remove(event: H3Event, id: string) {
    const db = useDb(event)
    await db.delete(productVariants).where(eq(productVariants.id, id))
  },
}
