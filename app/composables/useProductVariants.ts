/**
 * Shared variant-selection logic for product pages — used by both the
 * standard product page and the Landing one-page template so attribute
 * grouping, in-stock default selection, and price/stock derivation stay
 * identical across both layouts.
 */
export function useProductVariants(product: Ref<any>) {
  const selectedValues = reactive<Record<string, string>>({})

  const attributeGroups = computed(() => {
    if (!product.value) return []
    const groups = new Map<string, { attributeId: string, attributeName: string, displayType: string, values: Map<string, any> }>()
    for (const variant of product.value.variants) {
      for (const attr of variant.attributes) {
        if (!groups.has(attr.attributeId)) {
          groups.set(attr.attributeId, { attributeId: attr.attributeId, attributeName: attr.attributeName, displayType: attr.displayType, values: new Map() })
        }
        groups.get(attr.attributeId)!.values.set(attr.valueId, { valueId: attr.valueId, value: attr.value, swatchHex: attr.swatchHex })
      }
    }
    return [...groups.values()].map(g => ({ ...g, values: [...g.values.values()] }))
  })

  const hasRealVariants = computed(() => attributeGroups.value.length > 0)

  const selectedVariant = computed(() => {
    if (!product.value) return null
    if (!hasRealVariants.value) return product.value.variants[0] ?? null
    return product.value.variants.find((v: any) =>
      attributeGroups.value.every(g => v.attributes.some((a: any) => a.attributeId === g.attributeId && a.valueId === selectedValues[g.attributeId])),
    ) ?? null
  })

  watchEffect(() => {
    if (!hasRealVariants.value || !product.value) return
    for (const group of attributeGroups.value) {
      if (!selectedValues[group.attributeId]) {
        const inStockValue = group.values.find((val: any) =>
          product.value.variants.some((v: any) =>
            v.stock > 0 && v.isActive && v.attributes.some((a: any) => a.valueId === val.valueId)),
        )
        selectedValues[group.attributeId] = (inStockValue ?? group.values[0])?.valueId
      }
    }
  })

  const displayPrice = computed(() => selectedVariant.value?.price ?? product.value?.basePrice ?? 0)
  const inStock = computed(() => (selectedVariant.value ? selectedVariant.value.isActive && selectedVariant.value.stock > 0 : false))

  return { selectedValues, attributeGroups, hasRealVariants, selectedVariant, displayPrice, inStock }
}
