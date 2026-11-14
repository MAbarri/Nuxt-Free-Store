<script setup lang="ts">
/**
 * One recursive row of the category→products tree used by the Marketing →
 * Social post generator's image browser (see social-posts.vue). All shared
 * state/handlers come from the `socialPostTree` provide/inject context set
 * up by the page, so this component only needs the node itself — it can
 * then render itself again for child categories without prop-drilling.
 */
interface CategoryNode {
  id: string
  name: string
  children: CategoryNode[]
}

interface ProductRow {
  id: string
  name: string
  sku: string
  basePrice: number
}

interface TreeContext {
  isCategoryExpanded: (id: string) => boolean
  isCategoryLoading: (id: string) => boolean
  productsForCategory: (id: string) => ProductRow[]
  toggleCategory: (id: string) => void
  isProductSelected: (id: string) => boolean
  selectProduct: (product: ProductRow) => void
}

const props = defineProps<{ node: CategoryNode, depth?: number }>()
const depth = computed(() => props.depth ?? 0)

const tree = inject<TreeContext>('socialPostTree')!
</script>

<template>
  <div>
    <button
      type="button"
      class="flex w-full items-center gap-1.5 py-1.5 pr-2 text-sm hover:bg-stone-50"
      :style="{ paddingLeft: `${8 + depth * 16}px` }"
      @click="tree.toggleCategory(node.id)"
    >
      <UIcon :name="tree.isCategoryExpanded(node.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4 shrink-0 text-stone-400" />
      <UIcon name="i-lucide-folder" class="size-4 shrink-0 text-stone-400" />
      <span class="truncate">{{ node.name }}</span>
    </button>

    <div v-if="tree.isCategoryExpanded(node.id)">
      <div v-if="tree.isCategoryLoading(node.id)" class="py-1 text-xs text-stone-400" :style="{ paddingLeft: `${32 + depth * 16}px` }">
        Loading…
      </div>
      <p v-else-if="!tree.productsForCategory(node.id).length && !node.children.length" class="py-1 text-xs text-stone-400" :style="{ paddingLeft: `${32 + depth * 16}px` }">
        No products here.
      </p>

      <button
        v-for="product in tree.productsForCategory(node.id)" :key="product.id"
        type="button"
        class="flex w-full items-center justify-between gap-2 py-1.5 pr-2 text-sm hover:bg-stone-50"
        :class="tree.isProductSelected(product.id) ? 'bg-primary-50 text-primary-700' : ''"
        :style="{ paddingLeft: `${32 + depth * 16}px` }"
        @click="tree.selectProduct(product)"
      >
        <span class="flex min-w-0 items-center gap-1.5">
          <UIcon name="i-lucide-shirt" class="size-4 shrink-0 text-stone-400" />
          <span class="truncate">{{ product.name }}</span>
        </span>
        <span class="shrink-0 text-xs text-stone-400">{{ product.sku }}</span>
      </button>

      <AdminCategoryTreeNode
        v-for="child in node.children" :key="child.id"
        :node="child" :depth="depth + 1"
      />
    </div>
  </div>
</template>
