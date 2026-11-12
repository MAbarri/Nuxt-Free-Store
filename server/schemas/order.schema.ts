import { z } from 'zod'

export const orderStatusValues = [
  'pending_confirmation',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'failed_delivery',
  'returned',
] as const

export const paymentStatusValues = ['unpaid', 'paid', 'refunded'] as const

export const orderListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(orderStatusValues).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
})

export const orderStatusUpdateSchema = z.object({
  status: z.enum(orderStatusValues),
  note: z.string().trim().max(500).optional(),
})

export const orderPaymentStatusUpdateSchema = z.object({
  paymentStatus: z.enum(paymentStatusValues),
})

export const orderNotesUpdateSchema = z.object({
  internalNotes: z.string().trim().max(2000),
})

export const orderTrackingUpdateSchema = z.object({
  trackingReference: z.string().trim().max(200),
})
