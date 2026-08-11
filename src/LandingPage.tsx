import { useContext, useEffect, useRef, useState } from 'react'
import { StatsigContext, useGateValue } from '@statsig/react-bindings'

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || '').replace(/\/+$/, '')

if (!APP_ORIGIN) {
  throw new Error('VITE_APP_ORIGIN is required')
}

const API_GATEWAY = (import.meta.env.VITE_API_GATEWAY || '').replace(/\/+$/, '')

const LANDING_DOCUMENT = '/landing-page/index.html'

// How long to wait on the billing API before showing the page with the prices
// the document ships with. A blank page is worse than a stale price.
const PRICING_TIMEOUT_MS = 2500

// Mirrors the FLAGS object the landing document declares.
export type LandingFlags = {
  infoOnlyMode: boolean
  registrationEnabled: boolean
  showLaunchBanner: boolean
}

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

export type LandingConfig = {
  flags: LandingFlags
  pricing: LandingPricing | null
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

type LandingFrameProps = {
  config: LandingConfig | null
}

export const LandingFrame = ({ config }: LandingFrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Fixed for the lifetime of the frame. Changing an iframe's src reloads the
  // document, so later updates go over postMessage instead.
  const [src] = useState(() =>
    config
      ? `${LANDING_DOCUMENT}#config=${encodeURIComponent(JSON.stringify(config))}`
      : LANDING_DOCUMENT,
  )

  useEffect(() => {
    const handleLandingPageMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return
      }

      if (event.data?.type === 'loomkeeper:login') {
        window.location.assign(`${APP_ORIGIN}/auth/login`)
      }

      if (event.data?.type === 'loomkeeper:register') {
        window.location.assign(`${APP_ORIGIN}/auth/register`)
      }
    }

    window.addEventListener('message', handleLandingPageMessage)
    return () => window.removeEventListener('message', handleLandingPageMessage)
  }, [])

  // Only for gates that flip while the page is open — the values that matter on
  // first paint already went in through the src above.
  useEffect(() => {
    if (!config) return

    iframeRef.current?.contentWindow?.postMessage(
      { type: 'loomkeeper:landing-flags', flags: config.flags },
      window.location.origin,
    )
  }, [config])

  return (
    <iframe
      ref={iframeRef}
      className='landing-frame'
      src={src}
      title='Loomkeeper landing page'
    />
  )
}

const LandingPage = () => {
  const { isLoading } = useContext(StatsigContext)
  const infoOnlyMode = useGateValue('info-only-mode')
  const waitlistEnabled = useGateValue('waitlist-enabled')
  const showLaunchBanner = useGateValue('show-launch-banner')
  const pricing = usePricing()

  // Nothing is rendered until the gates and prices are in hand, so the document
  // mounts once with its final values in the URL and paints in its end state.
  // Rendering it earlier and correcting it afterwards is what made the CTAs and
  // prices visibly change under the visitor.
  if (isLoading || !pricing.settled) {
    return null
  }

  return (
    <LandingFrame
      config={{
        flags: {
          infoOnlyMode: Boolean(infoOnlyMode),
          // The waitlist and open registration are the two sides of one switch:
          // while the waitlist is on, CTAs collect signups instead of opening
          // the register flow.
          registrationEnabled: !waitlistEnabled,
          showLaunchBanner: Boolean(showLaunchBanner),
        },
        pricing: pricing.pricing,
      }}
    />
  )
}

export default LandingPage
