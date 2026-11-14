import { createError, type H3Event } from 'h3'
import { customersRepository, type CustomerListFilters } from '../repositories/customers.repository'

export const customersService = {
  list(event: H3Event, filters: CustomerListFilters) {
    return customersRepository.list(event, filters)
  },

  async getDetail(event: H3Event, profileId: string) {
    const profile = await customersRepository.findProfileById(event, profileId)
    if (!profile) throw createError({ statusCode: 404, statusMessage: 'Customer not found' })

    const [addresses, ordersList, totals] = await Promise.all([
      customersRepository.listAddresses(event, profileId),
      customersRepository.listOrders(event, profileId),
      customersRepository.totals(event, profileId),
    ])

    return { ...profile, addresses, orders: ordersList, ...totals }
  },

  async updateNotes(event: H3Event, profileId: string, notes: string) {
    const profile = await customersRepository.findProfileById(event, profileId)
    if (!profile) throw createError({ statusCode: 404, statusMessage: 'Customer not found' })
    await customersRepository.updateNotes(event, profileId, notes || null)
    return this.getDetail(event, profileId)
  },

  backfillFromOrders(event: H3Event) {
    return customersRepository.backfillFromOrders(event)
  },
}
