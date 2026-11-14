<script setup lang="ts">
const { data: me, refresh } = await useFetch('/api/auth/me', { key: 'admin-topbar-me' })
const mobileNavOpen = useAdminMobileNav()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refresh()
  await navigateTo('/admin/login')
}
</script>

<template>
  <header class="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:px-6">
    <UButton
      icon="i-lucide-menu"
      variant="ghost"
      color="neutral"
      class="md:hidden"
      aria-label="Open menu"
      @click="mobileNavOpen = true"
    />
    <div class="hidden md:block" />
    <div class="flex items-center gap-3">
      <span class="hidden text-sm text-stone-500 sm:inline">{{ me?.data?.user?.email }}</span>
      <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-log-out" @click="logout">
        <span class="hidden sm:inline">Log out</span>
      </UButton>
    </div>
  </header>
</template>
