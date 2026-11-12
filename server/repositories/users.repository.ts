import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { users, customerProfiles } from '../database/schema'
import { useDb } from '../utils/db'
import { generateId } from '../utils/id'

export interface CreateUserInput {
  email: string
  passwordHash: string
  role: 'customer' | 'admin'
  fullName?: string
  phone?: string
}

export const usersRepository = {
  async findByEmail(event: H3Event, email: string) {
    const db = useDb(event)
    const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
    return row ?? null
  },

  async findById(event: H3Event, id: string) {
    const db = useDb(event)
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return row ?? null
  },

  async create(event: H3Event, input: CreateUserInput) {
    const db = useDb(event)
    const now = new Date()
    const id = generateId('usr')

    await db.insert(users).values({
      id,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      fullName: input.fullName ?? null,
      phone: input.phone ?? null,
      createdAt: now,
      updatedAt: now,
    })

    if (input.role === 'customer') {
      await db.insert(customerProfiles).values({
        id: generateId('cprof'),
        userId: id,
        createdAt: now,
        updatedAt: now,
      })
    }

    return this.findById(event, id)
  },

  async findCustomerProfileByUserId(event: H3Event, userId: string) {
    const db = useDb(event)
    const [row] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1)
    return row ?? null
  },
}
