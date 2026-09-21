import { useEffect, useState } from 'react'

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || '').replace(/\/+$/, '')

if (!APP_ORIGIN) {
  throw new Error('VITE_APP_ORIGIN is required')
}

const API_GATEWAY = (import.meta.env.VITE_API_GATEWAY || '').replace(/\/+$/, '')

// How long to wait on the billing API before showing the page with the prices
// the document ships with. A blank page is worse than a stale price.
const PRICING_TIMEOUT_MS = 2500

type Amount = {
  baseAmount: number
  effectiveAmount: number
}

// The billing API's shape, passed through rather than reshaped so the document
// reads the same field names the API returns. Amounts are in minor units.
export type LandingPricing = {
  subscription?: {
    currency: string
    monthly?: Amount
    yearly?: Amount
  }
  messages?: Amount & { currency: string }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readAmount = (value: unknown): Amount | undefined => {
  if (!isRecord(value)) return undefined
  if (typeof value.effectiveAmount !== 'number') return undefined

  return {
    effectiveAmount: value.effectiveAmount,
    baseAmount:
      typeof value.baseAmount === 'number'
        ? value.baseAmount
        : value.effectiveAmount,
  }
}

const readPricing = (payload: unknown): LandingPricing | null => {
  if (!isRecord(payload)) return null

  const pricing: LandingPricing = {}
  const subscription = payload.subscription

  if (isRecord(subscription) && typeof subscription.currency === 'string') {
    pricing.subscription = {
      currency: subscription.currency,
      monthly: readAmount(subscription.monthly),
      yearly: readAmount(subscription.yearly),
    }
  }

  const messages = readAmount(payload.messages)

  if (messages && isRecord(payload.messages)) {
    const currency = payload.messages.currency
    pricing.messages = {
      ...messages,
      currency: typeof currency === 'string' ? currency : 'usd',
    }
  }

  return pricing.subscription || pricing.messages ? pricing : null
}

// Resolves once the prices are known, or once waiting for them costs more than
// showing the document's own. `settled` gates the first render either way.
const usePricing = () => {
  const [state, setState] = useState<{
    settled: boolean
    pricing: LandingPricing | null
  }>({ settled: !API_GATEWAY, pricing: null })

  useEffect(() => {
    if (!API_GATEWAY) return

    const controller = new AbortController()
    let done = false

    const settle = (pricing: LandingPricing | null) => {
      if (done) return
      done = true
      setState({ settled: true, pricing })
    }

    const timer = setTimeout(() => settle(null), PRICING_TIMEOUT_MS)

    fetch(`${API_GATEWAY}/api/v1/pricing`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Pricing request failed with ${response.status}`)
        }

        return response.json() as Promise<unknown>
      })
      .then(payload => settle(readPricing(payload)))
      .catch(() => settle(null))
      .finally(() => clearTimeout(timer))

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [])

  return state
}

const useAppNavigation = () => {
  useEffect(() => {
    const handleAccountLink = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname !== '/auth/login' && url.pathname !== '/auth/register') {
        return
      }

      event.preventDefault()
      const appUrl = `${APP_ORIGIN}${url.pathname}`

      if (anchor.target === '_blank') {
        window.open(appUrl, '_blank', 'noopener,noreferrer')
        return
      }

      window.location.assign(appUrl)
    }

    document.addEventListener('click', handleAccountLink, true)
    return () => document.removeEventListener('click', handleAccountLink, true)
  }, [])
}

const LandingPage = () => {
  const pricing = usePricing()

  useAppNavigation()

  useEffect(() => {
    if (!pricing.settled) return

    const dispatch = (data: unknown) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data,
          origin: window.location.origin,
          source: window,
        }),
      )
    }

    dispatch({ type: 'loomkeeper:landing-pricing', pricing: pricing.pricing })
    document.body.classList.add('landing-host-ready')
  }, [pricing.pricing, pricing.settled])

  return null
}

export default LandingPage
