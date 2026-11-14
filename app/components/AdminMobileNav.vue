<script setup lang="ts">
const open = useAdminMobileNav()
</script>

<template>
  <USlideover v-model:open="open" side="left" :ui="{ content: 'w-64' }">
    <template #content>
      <div class="flex items-center justify-between px-5 py-5">
        <p class="font-display text-lg">Atelier Admin</p>
        <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" @click="open = false" />
      </div>
      <AdminNavLinks @navigate="open = false" />
    </template>
  </USlideover>
</template>
