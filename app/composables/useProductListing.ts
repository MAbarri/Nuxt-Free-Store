export function useProductListing(getCategorySlug: () => string | undefined) {
  const route = useRoute()
  const router = useRouter()

  const page = ref(Number(route.query.page) || 1)
  const sort = ref((route.query.sort as string) || 'newest')
  const search = ref((route.query.q as string) || '')
  const selectedValueIds = ref<string[]>(route.query.attr ? ([route.query.attr].flat() as string[]) : [])
  const pageSize = 12

  const products = ref<any[]>([])
  const total = ref(0)
  const loading = ref(true)

  async function load() {
    loading.value = true
    try {
      const result = await apiFetch<{ rows: any[], total: number }>('/api/products', {
        query: {
          category: getCategorySlug(),
          search: search.value || undefined,
          sort: sort.value,
          attributeValueIds: selectedValueIds.value.length ? selectedValueIds.value : undefined,
          page: page.value,
          pageSize,
        },
      })
      products.value = result.rows
      total.value = result.total
    }
    finally {
      loading.value = false
    }
  }

  function toggleValue(id: string) {
    selectedValueIds.value = selectedValueIds.value.includes(id)
      ? selectedValueIds.value.filter(v => v !== id)
      : [...selectedValueIds.value, id]
  }

  watch([sort, selectedValueIds], () => { page.value = 1 })
  watch([page, sort, selectedValueIds], () => {
    router.replace({ query: { ...route.query, page: page.value, sort: sort.value, attr: selectedValueIds.value } })
    load()
  })

  return { page, sort, search, selectedValueIds, pageSize, products, total, loading, load, toggleValue }
}
