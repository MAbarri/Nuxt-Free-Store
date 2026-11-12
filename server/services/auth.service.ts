import { createError, type H3Event } from 'h3'
import { usersRepository } from '../repositories/users.repository'
import { hashPassword, verifyPassword } from '../utils/password'
import { createSession, destroySession } from '../utils/session'
import { cartService } from './cart.service'
import { wishlistService } from './wishlist.service'

export interface RegisterInput {
  email: string
  password: string
  fullName: string
  phone?: string
}

export interface LoginInput {
  email: string
  password: string
}

async function mergeGuestData(event: H3Event, userId: string) {
  const profile = await usersRepository.findCustomerProfileByUserId(event, userId)
  if (!profile) return
  await cartService.mergeGuestCartIntoCustomer(event, profile.id)
  await wishlistService.mergeGuestWishlistIntoCustomer(event, profile.id)
}

export const authService = {
  async register(event: H3Event, input: RegisterInput) {
    const existing = await usersRepository.findByEmail(event, input.email)
    if (existing) {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
    }

    const passwordHash = await hashPassword(input.password)
    const user = await usersRepository.create(event, {
      email: input.email,
      passwordHash,
      role: 'customer',
      fullName: input.fullName,
      phone: input.phone,
    })
    if (!user) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create account' })
    }

    await createSession(event, user.id)
    await mergeGuestData(event, user.id)
    return sanitizeUser(user)
  },

  async login(event: H3Event, input: LoginInput) {
    const user = await usersRepository.findByEmail(event, input.email)
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
    }

    const valid = await verifyPassword(input.password, user.passwordHash)
    if (!valid) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
    }

    await createSession(event, user.id)
    await mergeGuestData(event, user.id)
    return sanitizeUser(user)
  },

  async logout(event: H3Event) {
    await destroySession(event)
  },
}

function sanitizeUser(user: { id: string, email: string, role: 'customer' | 'admin', fullName: string | null }) {
  return { id: user.id, email: user.email, role: user.role, fullName: user.fullName }
}
