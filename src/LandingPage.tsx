import { useCallback, useEffect, useRef, useState } from 'react'
import { useGateValue } from '@statsig/react-bindings'

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

type LandingFrameProps = {
  infoOnlyMode: boolean
  waitlistEnabled: boolean
}

const isPricingRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const LandingFrame = ({
  infoOnlyMode,
  waitlistEnabled,
}: LandingFrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [pricing, setPricing] = useState<LandingPagePricing>({})

  const sendLandingPageFlags = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'loomkeeper:landing-flags',
        infoOnlyMode,
        waitlistEnabled,
      },
      window.location.origin,
    )
  }, [infoOnlyMode, waitlistEnabled])

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

    const getPricing = async (path: string) => {
      const response = await fetch(`${apiGateway}/api/v1${path}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Pricing request failed with ${response.status}`)
      }

      return response.json() as Promise<unknown>
    }

    Promise.allSettled([
      getPricing('/billing/plan'),
      getPricing('/messages/credits/price'),
    ]).then(([subscriptionResult, afterlifeResult]) => {
      if (controller.signal.aborted) {
        return
      }

      const nextPricing: LandingPagePricing = {}

      if (
        subscriptionResult.status === 'fulfilled' &&
        isPricingRecord(subscriptionResult.value) &&
        typeof subscriptionResult.value.monthlyAmount === 'number' &&
        typeof subscriptionResult.value.yearlyAmount === 'number' &&
        typeof subscriptionResult.value.currency === 'string'
      ) {
        nextPricing.subscriptionPlan = {
          monthlyAmount: subscriptionResult.value.monthlyAmount,
          yearlyAmount: subscriptionResult.value.yearlyAmount,
          currency: subscriptionResult.value.currency,
        }
      }

      if (
        afterlifeResult.status === 'fulfilled' &&
        isPricingRecord(afterlifeResult.value) &&
        typeof afterlifeResult.value.effectiveAmount === 'number' &&
        typeof afterlifeResult.value.currency === 'string'
      ) {
        nextPricing.afterlifeMessage = {
          amount: afterlifeResult.value.effectiveAmount,
          currency: afterlifeResult.value.currency,
        }
      }

      setPricing(nextPricing)
    })

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
  const infoOnlyMode = useGateValue('info-only-mode')
  const waitlistEnabled = useGateValue('waitlist-enabled')

  return (
    <LandingFrame
      infoOnlyMode={Boolean(infoOnlyMode)}
      waitlistEnabled={Boolean(waitlistEnabled)}
    />
  )
}

export default LandingPage
