import { createError, type H3Event } from 'h3'
import { shippingRepository } from '../repositories/shipping.repository'
import { settingsService } from './settings.service'

export interface ShippingQuote {
  fee: number
  freeShippingApplied: boolean
}

export const shippingService = {
  /**
   * Resolves the shipping fee for a city.
   *
   * - If the merchant hasn't configured any shipping rates yet, falls back
   *   to the store's default shipping fee so checkout works out of the box.
   * - If rates exist but none match this city, the destination is treated
   *   as not currently deliverable (admins scope delivery by configuring
   *   rates — see spec §7 "Enable or disable delivery destinations").
   * - A zone's free-shipping threshold, when set, waives the fee once the
   *   cart subtotal reaches it.
   */
  async calculateFee(event: H3Event, city: string, subtotal: number): Promise<ShippingQuote> {
    const totalRates = await shippingRepository.countRates(event)

    if (totalRates === 0) {
      const settings = await settingsService.getPublicSettings(event)
      return { fee: settings.defaultShippingFee, freeShippingApplied: false }
    }

    const match = await shippingRepository.findActiveRateByCity(event, city)
    if (!match) {
      throw createError({
        statusCode: 422,
        statusMessage: `Sorry, we don't currently deliver to "${city}". Please check the city name or choose a different address.`,
      })
    }

    const threshold = match.zone.freeShippingThreshold
    if (threshold !== null && subtotal >= threshold) {
      return { fee: 0, freeShippingApplied: true }
    }

    return { fee: match.rate.fee, freeShippingApplied: false }
  },

  // --- Admin management (zones + rates) ---

  async listZonesWithRates(event: H3Event) {
    const [zones, rates] = await Promise.all([
      shippingRepository.listZones(event),
      shippingRepository.listRates(event),
    ])
    return zones.map(zone => ({
      ...zone,
      rates: rates.filter(r => r.zoneId === zone.id),
    }))
  },

  async createZone(event: H3Event, input: { name: string, freeShippingThreshold?: number | null, isActive?: boolean }) {
    const id = await shippingRepository.createZone(event, input)
    return shippingRepository.findZoneById(event, id)
  },

  async updateZone(event: H3Event, id: string, input: Partial<{ name: string, freeShippingThreshold: number | null, isActive: boolean }>) {
    const zone = await shippingRepository.findZoneById(event, id)
    if (!zone) throw createError({ statusCode: 404, statusMessage: 'Shipping zone not found' })
    await shippingRepository.updateZone(event, id, input)
    return shippingRepository.findZoneById(event, id)
  },

  async removeZone(event: H3Event, id: string) {
    const zone = await shippingRepository.findZoneById(event, id)
    if (!zone) throw createError({ statusCode: 404, statusMessage: 'Shipping zone not found' })
    await shippingRepository.removeZone(event, id)
  },

  async createRate(event: H3Event, input: { zoneId: string, city: string, fee: number, isActive?: boolean }) {
    const zone = await shippingRepository.findZoneById(event, input.zoneId)
    if (!zone) throw createError({ statusCode: 404, statusMessage: 'Shipping zone not found' })
    const id = await shippingRepository.createRate(event, input)
    return shippingRepository.findRateById(event, id)
  },

  async updateRate(event: H3Event, id: string, input: Partial<{ city: string, fee: number, isActive: boolean }>) {
    const rate = await shippingRepository.findRateById(event, id)
    if (!rate) throw createError({ statusCode: 404, statusMessage: 'Shipping rate not found' })
    await shippingRepository.updateRate(event, id, input)
    return shippingRepository.findRateById(event, id)
  },

  async removeRate(event: H3Event, id: string) {
    const rate = await shippingRepository.findRateById(event, id)
    if (!rate) throw createError({ statusCode: 404, statusMessage: 'Shipping rate not found' })
    await shippingRepository.removeRate(event, id)
  },
}
