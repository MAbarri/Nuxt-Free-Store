import { createError, type H3Event } from 'h3'
import { ordersRepository } from '../repositories/orders.repository'

export const ordersService = {
  async getDetail(event: H3Event, id: string) {
    const order = await ordersRepository.findById(event, id)
    if (!order) throw createError({ statusCode: 404, statusMessage: 'Order not found' })

    const [items, history] = await Promise.all([
      ordersRepository.listItems(event, order.id),
      ordersRepository.listStatusHistory(event, order.id),
    ])

    return { ...order, items, history }
  },
}
