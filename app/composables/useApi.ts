interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/**
 * Thin wrapper around $fetch that unwraps our `{ success, data }` envelope.
 *
 * On the server, the global `$fetch` does not forward the incoming
 * request's cookies to internal API calls — `useRequestFetch()` does. Without
 * it, server-rendered pages that depend on the session/guest cookie (cart,
 * wishlist, account) would silently see an empty/unauthenticated response.
 */
export async function apiFetch<T>(url: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
  const fetcher = import.meta.server ? useRequestFetch() : $fetch
  const res = await fetcher<ApiEnvelope<T>>(url, opts)
  return res.data
}

export function apiErrorMessage(error: unknown): string {
  const anyErr = error as any
  return anyErr?.data?.error?.message || anyErr?.message || 'Something went wrong'
}
