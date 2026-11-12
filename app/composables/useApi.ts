interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/** Thin wrapper around $fetch that unwraps our `{ success, data }` envelope. */
export async function apiFetch<T>(url: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
  const res = await $fetch<ApiEnvelope<T>>(url, opts)
  return res.data
}

export function apiErrorMessage(error: unknown): string {
  const anyErr = error as any
  return anyErr?.data?.error?.message || anyErr?.message || 'Something went wrong'
}
