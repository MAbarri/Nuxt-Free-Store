<script setup lang="ts">
interface NavLink { to: string, label: string, icon: string }
interface NavGroup { label: string | null, items: NavLink[] }

// Single source of truth for the admin nav, grouped into meaningful sections
// so the list stays scannable as more tools (e.g. Marketing) get added.
// Shared by the desktop sidebar and the mobile slideover.
const groups: NavGroup[] = [
  { label: null, items: [
    { to: '/admin', label: 'Overview', icon: 'i-lucide-layout-dashboard' },
  ] },
  { label: 'Catalog', items: [
    { to: '/admin/products', label: 'Products', icon: 'i-lucide-shirt' },
    { to: '/admin/categories', label: 'Categories', icon: 'i-lucide-folder-tree' },
    { to: '/admin/attributes', label: 'Attributes', icon: 'i-lucide-tags' },
    { to: '/admin/sizes', label: 'Size guides', icon: 'i-lucide-ruler' },
    { to: '/admin/inventory', label: 'Inventory', icon: 'i-lucide-boxes' },
  ] },
  { label: 'Sales', items: [
    { to: '/admin/orders', label: 'Orders', icon: 'i-lucide-package' },
    { to: '/admin/customers', label: 'Customers', icon: 'i-lucide-users' },
    { to: '/admin/shipping', label: 'Shipping', icon: 'i-lucide-truck' },
  ] },
  { label: 'Marketing', items: [
    { to: '/admin/marketing', label: 'Marketing dashboard', icon: 'i-lucide-megaphone' },
    { to: '/admin/marketing/social-posts', label: 'Social post generator', icon: 'i-lucide-sparkles' },
    { to: '/admin/marketing/meta-ads', label: 'Meta ads manager', icon: 'i-lucide-facebook' },
    { to: '/admin/marketing/tiktok-ads', label: 'TikTok ads manager', icon: 'i-lucide-music-2' },
  ] },
  { label: 'Settings', items: [
    { to: '/admin/settings', label: 'Settings', icon: 'i-lucide-settings' },
  ] },
]

const emit = defineEmits<{ navigate: [] }>()
</script>

<template>
  <nav class="flex flex-col gap-4 px-2">
    <div v-for="group in groups" :key="group.label ?? '__root'">
      <p v-if="group.label" class="px-3 pb-1 text-xs font-medium tracking-wide text-stone-400 uppercase">
        {{ group.label }}
      </p>
      <div class="flex flex-col gap-0.5">
        <UButton
          v-for="link in group.items"
          :key="link.to"
          :to="link.to"
          :icon="link.icon"
          variant="ghost"
          color="neutral"
          class="justify-start"
          block
          @click="emit('navigate')"
        >
          {{ link.label }}
        </UButton>
      </div>
    </div>
  </nav>
</template>
