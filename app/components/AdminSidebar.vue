<script setup lang="ts">
const links = [
  { to: '/admin', label: 'Overview', icon: 'i-lucide-layout-dashboard' },
  { to: '/admin/products', label: 'Products', icon: 'i-lucide-shirt' },
  { to: '/admin/categories', label: 'Categories', icon: 'i-lucide-folder-tree' },
  { to: '/admin/orders', label: 'Orders', icon: 'i-lucide-package' },
  { to: '/admin/customers', label: 'Customers', icon: 'i-lucide-users' },
  { to: '/admin/inventory', label: 'Inventory', icon: 'i-lucide-boxes' },
  { to: '/admin/shipping', label: 'Shipping', icon: 'i-lucide-truck' },
  { to: '/admin/settings', label: 'Settings', icon: 'i-lucide-settings' },
]
</script>

<template>
  <aside class="hidden w-60 shrink-0 border-r border-stone-200 bg-white md:block">
    <div class="px-5 py-5">
      <p class="font-display text-lg">Atelier Admin</p>
    </div>
    <nav class="flex flex-col gap-0.5 px-2">
      <UButton
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        :icon="link.icon"
        variant="ghost"
        color="neutral"
        class="justify-start"
        block
      >
        {{ link.label }}
      </UButton>
    </nav>
  </aside>
</template>
