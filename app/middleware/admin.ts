export default defineNuxtRouteMiddleware(async () => {
  const { data } = await useFetch('/api/auth/me', { key: 'admin-guard-me' })
  const user = data.value?.data?.user
  if (!user || user.role !== 'admin') {
    return navigateTo('/admin/login')
  }
})
