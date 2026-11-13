<script setup lang="ts">
defineProps<{ guide: { title: string, content: { columns: string[], rows: Record<string, string>[] } } }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal v-model:open="open" :title="guide.title">
    <template #body>
      <table class="w-full text-sm">
        <thead>
          <tr>
            <th v-for="col in guide.content.columns" :key="col" class="pb-2 pe-4 text-start text-stone-500">
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in guide.content.rows" :key="i" class="border-t border-stone-100">
            <td v-for="col in guide.content.columns" :key="col" class="py-2 pe-4">
              {{ row[col] }}
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </UModal>
</template>
