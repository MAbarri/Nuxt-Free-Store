<script setup lang="ts">
const { data: me, refresh } = await useAsyncData('admin-me', () => $fetch('/api/auth/me'))

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refresh()
  await navigateTo('/admin/login')
}
</script>

<template>
  <header class="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
    <div />
    <div class="flex items-center gap-3">
      <span class="text-sm text-stone-500">{{ me?.data?.user?.email }}</span>
      <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-log-out" @click="logout">
        Log out
      </UButton>
    </div>
  </header>
</template>
