import { eq } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import { wishlistRepository } from '../repositories/wishlist.repository'
import { resolveCustomerProfileId } from '../utils/customer'
import { getGuestToken, getOrCreateGuestToken } from '../utils/guestToken'
import { useDb } from '../utils/db'
import { products, productImages } from '../database/schema'

async function findExistingWishlist(event: H3Event) {
  const customerProfileId = await resolveCustomerProfileId(event)
  if (customerProfileId) {
    const wishlist = await wishlistRepository.findByCustomerProfileId(event, customerProfileId)
    if (wishlist) return wishlist
  }
  const guestToken = getGuestToken(event)
  if (guestToken) {
    const wishlist = await wishlistRepository.findByGuestToken(event, guestToken)
    if (wishlist) return wishlist
  }
  return null
}

async function getOrCreateWishlist(event: H3Event) {
  const existing = await findExistingWishlist(event)
  if (existing) return existing

  const customerProfileId = await resolveCustomerProfileId(event)
  const id = customerProfileId
    ? await wishlistRepository.create(event, { customerProfileId })
    : await wishlistRepository.create(event, { guestToken: getOrCreateGuestToken(event) })

  const created = await wishlistRepository.findById(event, id)
  if (!created) throw createError({ statusCode: 500, statusMessage: 'Failed to create wishlist' })
  return created
}

export const wishlistService = {
  async list(event: H3Event) {
    const wishlist = await findExistingWishlist(event)
    if (!wishlist) return { items: [] }

    const items = await wishlistRepository.listItems(event, wishlist.id)
    const db = useDb(event)

    const hydrated = await Promise.all(items.map(async (item) => {
      const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1)
      const images = product
        ? await db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(productImages.sortOrder).limit(1)
        : []
      return {
        productId: item.productId,
        name: product?.name ?? 'No longer available',
        slug: product?.slug ?? null,
        basePrice: product?.basePrice ?? 0,
        primaryImageUrl: images[0]?.url ?? null,
        available: !!product && product.status === 'active' && !product.deletedAt,
      }
    }))

    return { items: hydrated }
  },

  async addItem(event: H3Event, productId: string, variantId?: string | null) {
    const db = useDb(event)
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)
    if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })

    const wishlist = await getOrCreateWishlist(event)
    await wishlistRepository.addItem(event, wishlist.id, productId, variantId ?? null)
    return this.list(event)
  },

  async removeItem(event: H3Event, productId: string) {
    const wishlist = await findExistingWishlist(event)
    if (wishlist) await wishlistRepository.removeItemByProduct(event, wishlist.id, productId)
    return this.list(event)
  },

  /** Called right after login/registration to fold a guest wishlist into the customer's account wishlist. */
  async mergeGuestWishlistIntoCustomer(event: H3Event, customerProfileId: string) {
    const guestToken = getGuestToken(event)
    if (!guestToken) return

    const guestWishlist = await wishlistRepository.findByGuestToken(event, guestToken)
    if (!guestWishlist) return

    const items = await wishlistRepository.listItems(event, guestWishlist.id)

    let accountWishlist = await wishlistRepository.findByCustomerProfileId(event, customerProfileId)
    if (!accountWishlist) {
      const id = await wishlistRepository.create(event, { customerProfileId })
      accountWishlist = await wishlistRepository.findById(event, id)
    }
    if (!accountWishlist) return

    for (const item of items) {
      await wishlistRepository.addItem(event, accountWishlist.id, item.productId, item.variantId)
    }

    await wishlistRepository.remove(event, guestWishlist.id)
  },
}
