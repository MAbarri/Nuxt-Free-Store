import type { H3Event } from 'h3'
import { usersRepository } from '../repositories/users.repository'
import { getAuthUser } from './session'

/** Resolves the logged-in customer's profile id, or null for guests/admins. */
export async function resolveCustomerProfileId(event: H3Event): Promise<string | null> {
  const user = await getAuthUser(event)
  if (!user) return null
  const profile = await usersRepository.findCustomerProfileByUserId(event, user.id)
  return profile?.id ?? null
}
