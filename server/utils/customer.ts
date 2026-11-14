import type { H3Event } from 'h3'
import { usersRepository } from '../repositories/users.repository'
import { customersRepository, type FindOrCreateCustomerInput } from '../repositories/customers.repository'
import { getAuthUser } from './session'

/**
 * Resolves the buyer's customer_profiles id — the account-free, phone-keyed
 * identity used across cart/wishlist/checkout.
 *
 * - Logged-in user with an existing profile: returns it unchanged.
 * - Logged-in user with no profile yet (e.g. registered without a phone):
 *   falls back to find-or-create by phone when `input` is given, and links
 *   the new profile to their account.
 * - Guest: find-or-creates by phone when `input` is given, otherwise null
 *   (cart/wishlist call this with no input for guests, where there's no
 *   phone to key off yet).
 */
export async function resolveCustomerProfileId(event: H3Event, input?: FindOrCreateCustomerInput): Promise<string | null> {
  const user = await getAuthUser(event)
  if (user) {
    const profile = await usersRepository.findCustomerProfileByUserId(event, user.id)
    if (profile) return profile.id
    if (!input) return null
    return customersRepository.findOrCreateByPhone(event, input, user.id)
  }

  if (!input) return null
  return customersRepository.findOrCreateByPhone(event, input)
}
