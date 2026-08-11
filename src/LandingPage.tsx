import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { StatsigContext, useGateValue } from '@statsig/react-bindings'

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN || '').replace(/\/+$/, '')

if (!APP_ORIGIN) {
  throw new Error('VITE_APP_ORIGIN is required')
}

type LandingPagePricing = {
  subscriptionPlan?: {
    currency: string
    monthlyAmount: number
    yearlyAmount: number
  }
  afterlifeMessage?: {
    amount: number
    currency: string
  }
}

// Mirrors the FLAGS object the landing document declares. It ships with the
// cautious values baked in and applies whatever arrives here on top, so passing
// null while the gates are still resolving leaves those defaults in place.
export type LandingFlags = {
  infoOnlyMode: boolean
  registrationEnabled: boolean
  showLaunchBanner: boolean
}

type LandingFrameProps = {
  flags: LandingFlags | null
}

const isPricingRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const LandingFrame = ({ flags }: LandingFrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [pricing, setPricing] = useState<LandingPagePricing>({})

  const sendLandingPageFlags = useCallback(() => {
    if (!flags) {
      return
    }

    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'loomkeeper:landing-flags',
        flags,
      },
      window.location.origin,
    )
  }, [flags])

  const sendLandingPagePricing = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'loomkeeper:landing-pricing',
        ...pricing,
      },
      window.location.origin,
    )
  }, [pricing])

  useEffect(() => {
    const apiGateway = (import.meta.env.VITE_API_GATEWAY || '').replace(
      /\/+$/,
      '',
    )

    if (!apiGateway) {
      return
    }

    const controller = new AbortController()

    const getPricing = async () => {
      const response = await fetch(`${apiGateway}/api/v1/pricing`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Pricing request failed with ${response.status}`)
      }

      return response.json() as Promise<unknown>
    }

    getPricing()
      .then(pricingResult => {
        if (controller.signal.aborted) {
          return
        }

        const nextPricing: LandingPagePricing = {}
        const subscription =
          isPricingRecord(pricingResult) &&
          isPricingRecord(pricingResult.subscription)
            ? pricingResult.subscription
            : null
        const monthly =
          subscription && isPricingRecord(subscription.monthly)
            ? subscription.monthly
            : null
        const yearly =
          subscription && isPricingRecord(subscription.yearly)
            ? subscription.yearly
            : null
        const messages =
          isPricingRecord(pricingResult) &&
          isPricingRecord(pricingResult.messages)
            ? pricingResult.messages
            : null

        if (
          subscription &&
          monthly &&
          yearly &&
          typeof monthly.effectiveAmount === 'number' &&
          typeof yearly.effectiveAmount === 'number' &&
          typeof subscription.currency === 'string'
        ) {
          nextPricing.subscriptionPlan = {
            monthlyAmount: monthly.effectiveAmount,
            yearlyAmount: yearly.effectiveAmount,
            currency: subscription.currency,
          }
        }

        if (
          messages &&
          typeof messages.effectiveAmount === 'number' &&
          typeof messages.currency === 'string'
        ) {
          nextPricing.afterlifeMessage = {
            amount: messages.effectiveAmount,
            currency: messages.currency,
          }
        }

        setPricing(nextPricing)
      })
      .catch(() => undefined)

    return () => controller.abort()
  }, [])

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

      if (event.data?.type === 'loomkeeper:landing-ready') {
        sendLandingPageFlags()
        sendLandingPagePricing()
      }
    }

    window.addEventListener('message', handleLandingPageMessage)
    return () => window.removeEventListener('message', handleLandingPageMessage)
  }, [sendLandingPageFlags, sendLandingPagePricing])

  useEffect(() => {
    sendLandingPageFlags()
  }, [sendLandingPageFlags])

  useEffect(() => {
    sendLandingPagePricing()
  }, [sendLandingPagePricing])

  return (
    <iframe
      ref={iframeRef}
      className='landing-frame'
      src='/landing-page/index.html'
      title='Loomkeeper landing page'
      onLoad={() => {
        sendLandingPageFlags()
        sendLandingPagePricing()
      }}
    />
  )
}

const LandingPage = () => {
  const { isLoading } = useContext(StatsigContext)
  const infoOnlyMode = useGateValue('info-only-mode')
  const waitlistEnabled = useGateValue('waitlist-enabled')
  const showLaunchBanner = useGateValue('show-launch-banner')

  // One LandingFrame for the whole session. Rendering a second copy while
  // Statsig initialises (as a provider loadingComponent did) unmounts this
  // iframe and remounts a new one, reloading the whole landing document and
  // flashing the page.
  //
  // Gate reads return false before the client is ready, which would read as
  // "registration is open" — so send nothing until it settles and let the
  // document's own cautious defaults stand.
  return (
    <LandingFrame
      flags={
        isLoading
          ? null
          : {
              infoOnlyMode: Boolean(infoOnlyMode),
              // The waitlist and open registration are the two sides of one
              // switch: while the waitlist is on, CTAs collect signups instead
              // of opening the register flow.
              registrationEnabled: !waitlistEnabled,
              showLaunchBanner: Boolean(showLaunchBanner),
            }
      }
    />
  )
}

export default LandingPage
