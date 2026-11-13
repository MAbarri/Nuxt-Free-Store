import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyticsService } from '../../server/services/analytics.service'
import { hashForMatching } from '../../server/utils/metaConversionsApi'

function fakeEvent(overrides: Record<string, unknown> = {}) {
  return { context: { cloudflare: { env: { ...env, ...overrides } }, guestToken: null, auth: null } } as any
}

describe('hashForMatching', () => {
  it('returns the SHA-256 hex digest of the given value', async () => {
    // Well-known test vector.
    await expect(hashForMatching('hello')).resolves.toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
  })

  it('is case/whitespace sensitive — normalization is the caller\'s responsibility', async () => {
    const a = await hashForMatching('test@example.com')
    const b = await hashForMatching('Test@Example.com')
    expect(a).not.toBe(b)
  })
})

describe('analyticsService.trackPurchase', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no-ops without making a network call when FB_CONVERSIONS_ACCESS_TOKEN is not set', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const event = fakeEvent({ FB_CONVERSIONS_ACCESS_TOKEN: undefined })
    await expect(analyticsService.trackPurchase(event, {
      orderId: 'ord_test',
      total: 29900,
      currency: 'MAD',
      productIds: ['prod_1'],
      numItems: 1,
      email: 'test@example.com',
      phone: '0600000000',
    })).resolves.toBeUndefined()

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('no-ops when the token is set but the Conversion API toggle/pixel id are not configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const event = fakeEvent({ FB_CONVERSIONS_ACCESS_TOKEN: 'test-token' })
    await analyticsService.trackPurchase(event, {
      orderId: 'ord_test_2',
      total: 10000,
      currency: 'MAD',
      productIds: ['prod_1'],
      numItems: 1,
    })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('never throws even if the underlying request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const event = fakeEvent({ FB_CONVERSIONS_ACCESS_TOKEN: undefined })
    await expect(analyticsService.trackPurchase(event, {
      orderId: 'ord_test_3',
      total: 10000,
      currency: 'MAD',
      productIds: ['prod_1'],
      numItems: 1,
    })).resolves.toBeUndefined()
  })
})
