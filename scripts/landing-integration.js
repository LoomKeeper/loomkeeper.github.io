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

// The yearly figure sits inside a translated sentence rather than in an element
// of its own, and different languages place the currency differently — "$49" in
// English and Hebrew, "49 $" in Polish, Spanish and French — so match the amount
// with a symbol on either side.
const YEARLY_LITERAL = /(?:[$€£]\s*)?\b49\b(?:\s*[$€£])?/

// Edits the sentence in place. The export's i18n keeps a direct reference to
// this text node and rewrites it on every language change, so replacing the node
// would quietly stop that sentence translating.
function applyYearlyPrice(pricing) {
  const subscription = pricing && pricing.subscription
  const yearly = subscription && subscription.yearly

  if (!yearly || typeof yearly.effectiveAmount !== 'number') return

  // The featured card only — the free tier has a .per of its own.
  const per = document.querySelector('.price-card.featured .per')

  if (!per) return

  const amount = formatAmount(yearly.effectiveAmount, subscription.currency)

  for (const node of per.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE) continue
    if (node.nodeValue.includes(amount)) continue
    if (!YEARLY_LITERAL.test(node.nodeValue)) continue

    node.nodeValue = node.nodeValue.replace(YEARLY_LITERAL, amount)
  }
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

  // Deliberately not applyYearlyPrice — this runs while the document is still
  // parsing, and that substitution has to wait until the i18n pass has
  // registered the sentence. See startYearlyPrice below.
}

// The export registers its translatable text nodes on DOMContentLoaded by
// matching each one against its English source string. Substituting the amount
// before that runs would leave this sentence unrecognised and permanently
// untranslated — and because this script is injected higher up the document than
// the i18n one, its own DOMContentLoaded handler would fire first. Deferring by a
// task orders the substitution after registration, still ahead of the first
// paint. The observer then re-applies it whenever a language switch restores the
// literal; our own edit re-enters and exits on the already-applied check.
function startYearlyPrice() {
  const run = () =>
    setTimeout(() => {
      applyYearlyPrice(currentPricing)

      const per = document.querySelector('.price-card.featured .per')

      if (!per) return

      new MutationObserver(() => applyYearlyPrice(currentPricing)).observe(per, {
        characterData: true,
        childList: true,
        subtree: true,
      })
    }, 0)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true })
  } else {
    run()
  }
}

// Tracked separately from HOST_CONFIG so a later update over postMessage is
// what the language-change observer re-applies.
let currentPricing = HOST_CONFIG.pricing

applyPricing(currentPricing)
startYearlyPrice()

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
    currentPricing = event.data.pricing
    applyPricing(currentPricing)
    // Safe to run directly here: by the time a message can arrive the i18n pass
    // has long since registered the sentence.
    applyYearlyPrice(currentPricing)
  }
})
