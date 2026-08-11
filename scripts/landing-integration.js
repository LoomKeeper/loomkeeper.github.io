// Injected into the landing document by scripts/import-landing-bundle.mjs,
// immediately after the export's FLAGS literal and before it calls applyFlags().
//
// It lives here rather than in public/landing-page/index.html because that file
// is regenerated from the design-tool export; anything edited into it by hand is
// lost on the next import.
//
// The host resolves the Statsig gates and the billing API before it mounts this
// frame and puts the result in the URL fragment. Reading it here — while this
// script is still parsing, before the first paint — means the page renders once,
// in its final state. Receiving the same values over postMessage afterwards is
// what made the CTAs and prices visibly change under the visitor. The fragment
// never reaches the server, and these values are public either way.

const HOST_CONFIG = (() => {
  const match = /(?:^|[#&])config=([^&]+)/.exec(window.location.hash)

  if (!match) return {}

  try {
    return JSON.parse(decodeURIComponent(match[1])) || {}
  } catch (error) {
    console.warn('landing: unreadable host config', error)
    return {}
  }
})()

if (HOST_CONFIG.flags && typeof HOST_CONFIG.flags === 'object') {
  Object.assign(FLAGS, HOST_CONFIG.flags)
}

// ===== Prices from the billing API =====
// Amounts arrive in minor units. Where a promotion is auto-applied the list
// price is kept alongside it, struck through, so the page states both what the
// plan costs and what it costs today.
function formatAmount(minorUnits, currency) {
  const value = minorUnits / 100

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Replaces the amount while leaving the trailing <small> unit label — and its
// inline styling — exactly as authored.
function setAmount(el, base, effective, currency) {
  if (!el || typeof effective !== 'number') return

  const unit = el.querySelector('small')
  el.textContent = ''

  if (typeof base === 'number' && base > effective) {
    const was = document.createElement('s')
    was.textContent = formatAmount(base, currency)
    was.style.cssText =
      'font-size:.55em;font-weight:600;color:var(--muted);margin-inline-end:.3em'
    el.append(was)
  }

  el.append(document.createTextNode(formatAmount(effective, currency)))

  if (unit) el.append(unit)
}

function applyPricing(pricing) {
  if (!pricing || typeof pricing !== 'object') return

  const subscription = pricing.subscription

  if (subscription && subscription.monthly) {
    // The paid tier only. A plain .price-card is the free one, whose "Free
    // forever" must not be overwritten with an amount.
    setAmount(
      document.querySelector('.price-card.featured .price'),
      subscription.monthly.baseAmount,
      subscription.monthly.effectiveAmount,
      subscription.currency,
    )
  }

  if (pricing.messages) {
    setAmount(
      document.querySelector('.standalone-price'),
      pricing.messages.baseAmount,
      pricing.messages.effectiveAmount,
      pricing.messages.currency,
    )
  }
}

applyPricing(HOST_CONFIG.pricing)

// Only for values that change while the page is open — a gate flipped
// mid-session. The first paint is already correct, so this repaint is a
// deliberate update rather than a load-time flash.
window.addEventListener('message', event => {
  if (event.origin !== window.location.origin) return
  if (!event.data) return

  if (event.data.type === 'loomkeeper:landing-flags') {
    const incoming = event.data.flags

    if (!incoming || typeof incoming !== 'object') return

    Object.assign(FLAGS, incoming)
    applyFlags()
    syncSwitches()
  }

  if (event.data.type === 'loomkeeper:landing-pricing') {
    applyPricing(event.data.pricing)
  }
})
