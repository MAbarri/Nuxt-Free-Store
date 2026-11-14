import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['customer', 'admin'] }).notNull().default('customer'),
  fullName: text('full_name'),
  phone: text('phone'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  uniqueIndex('users_email_unique').on(table.email),
]))

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // opaque session token
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('sessions_user_id_idx').on(table.userId),
]))

// Every buyer — guest or (later) logged-in — identified primarily by phone
// number, the real COD identity key in Morocco. `userId` is kept nullable:
// a future customer-login feature links into this same record rather than
// duplicating it, but no order ever requires an account to produce one.
export const customerProfiles = sqliteTable('customer_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull(), // normalized via normalizePhoneMA — canonical identity key
  fullName: text('full_name').notNull(), // latest known name
  email: text('email'), // latest known email, nullable
  notes: text('notes'), // internal admin notes about this customer
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  uniqueIndex('customer_profiles_user_id_unique').on(table.userId),
  uniqueIndex('customer_profiles_phone_unique').on(table.phone),
]))

export const addresses = sqliteTable('addresses', {
  id: text('id').primaryKey(),
  customerProfileId: text('customer_profile_id').notNull()
    .references(() => customerProfiles.id, { onDelete: 'cascade' }),
  label: text('label'), // e.g. "Home", "Work"
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  city: text('city').notNull(),
  addressLine: text('address_line').notNull(),
  instructions: text('instructions'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, table => ([
  index('addresses_customer_profile_id_idx').on(table.customerProfileId),
]))
