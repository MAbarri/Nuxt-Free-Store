interface CartItem {
  id: string
  productId: string
  variantId: string | null
  productName: string
  productSlug: string | null
  sku: string | null
  imageUrl: string | null
  quantity: number
  available: boolean
  stock: number
  exceedsStock: boolean
  unitPrice: number
  subtotal: number
}
interface CartState {
  id: string | null
  items: CartItem[]
  subtotal: number
  itemCount: number
}

export function useCart() {
  const cart = useState<CartState>('cart', () => ({ id: null, items: [], subtotal: 0, itemCount: 0 }))

  async function refresh() {
    cart.value = await apiFetch<CartState>('/api/cart')
  }

  async function addItem(productId: string, variantId: string | null, quantity = 1) {
    cart.value = await apiFetch<CartState>('/api/cart/items', {
      method: 'POST',
      body: { productId, variantId, quantity },
    })
  }

  async function updateQuantity(itemId: string, quantity: number) {
    cart.value = await apiFetch<CartState>(`/api/cart/items/${itemId}`, { method: 'PUT', body: { quantity } })
  }

  async function removeItem(itemId: string) {
    cart.value = await apiFetch<CartState>(`/api/cart/items/${itemId}`, { method: 'DELETE' })
  }

  async function clear() {
    cart.value = await apiFetch<CartState>('/api/cart', { method: 'DELETE' })
  }

  return { cart, refresh, addItem, updateQuantity, removeItem, clear }
}
