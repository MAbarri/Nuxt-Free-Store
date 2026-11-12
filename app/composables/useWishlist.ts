interface WishlistItem {
  productId: string
  name: string
  slug: string | null
  basePrice: number
  primaryImageUrl: string | null
  available: boolean
}
interface WishlistState {
  items: WishlistItem[]
}

export function useWishlist() {
  const wishlist = useState<WishlistState>('wishlist', () => ({ items: [] }))

  async function refresh() {
    wishlist.value = await apiFetch<WishlistState>('/api/wishlist')
  }

  async function addItem(productId: string, variantId?: string | null) {
    wishlist.value = await apiFetch<WishlistState>('/api/wishlist/items', {
      method: 'POST',
      body: { productId, variantId },
    })
  }

  async function removeItem(productId: string) {
    wishlist.value = await apiFetch<WishlistState>(`/api/wishlist/items/${productId}`, { method: 'DELETE' })
  }

  function isWishlisted(productId: string) {
    return wishlist.value.items.some(i => i.productId === productId)
  }

  return { wishlist, refresh, addItem, removeItem, isWishlisted }
}
