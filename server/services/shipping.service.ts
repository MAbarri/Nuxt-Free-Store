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
}
