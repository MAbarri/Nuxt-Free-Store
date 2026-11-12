<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const res = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    if (res.data.user.role !== 'admin') {
      error.value = 'This account does not have admin access.'
      return
    }
    await navigateTo('/admin')
  }
  catch (e: any) {
    error.value = e?.data?.error?.message || 'Login failed'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-stone-100 px-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <p class="font-display text-xl">Atelier Admin</p>
      </template>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Email">
          <UInput v-model="email" type="email" required class="w-full" />
        </UFormField>
        <UFormField label="Password">
          <UInput v-model="password" type="password" required class="w-full" />
        </UFormField>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <UButton type="submit" block :loading="loading">
          Log in
        </UButton>
      </form>
    </UCard>
  </div>
</template>
