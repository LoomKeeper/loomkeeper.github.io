# Measurement: marketing site to app (WEB-42)

A short design note on how we measure traffic from www.loomkeeper.com into the
Loomkeeper web app, and what we can and cannot see today.

## Sources of truth

- **Search: Google Search Console.** Queries, impressions and search clicks for
  www.loomkeeper.com come from Search Console. Nothing on this site tries to
  replicate those numbers.
- **Placement: UTM tags on marketing-to-app links.** Every signup and login link
  from this site to the app carries
  `utm_source=loomkeeper.com&utm_medium=website&utm_campaign=<placement>`, so the
  app side can tell which part of the page a visitor clicked.

WEB-42 adds **no cookies, no analytics scripts and no new vendors**. The tags
are plain query parameters on links the page already had.

The marketing site already had a cookie-consent banner and a consent-gated
Google Analytics bootstrap (injected by `vite.config.ts`). It was there before
WEB-42, WEB-42 does not change it, and it is out of scope here.

## Events

These are three separate events. Don't merge them in reporting.

| Event | Definition | Observable today? |
| --- | --- | --- |
| **Click** | A visitor follows a tagged marketing-to-app signup or login link. | Yes. The app's signup or login page opens with the UTM tags in its URL. |
| **Registration** | An account is actually created. | Not attributable to a placement. Nothing links the account to the tagged URL. |
| **Activation** | The first meaningful product use after registration. | Not attributable to a placement, for the same reason. |

Only the click can be seen from the tagged URL today. A click is not a
registration, and a registration is not an activation.

## Placement inventory

All links live in `landing-page/index.html`. Source hrefs are same-site paths;
the build rewrites them to `VITE_APP_ORIGIN` (production:
`https://app.loomkeeper.com`) and keeps the query string as written.

| `utm_campaign` | Route | Link text | Where |
| --- | --- | --- | --- |
| `nav` | `/auth/login` | My Loomkeeper | Desktop nav (`.nav-cta`), opens in a new tab |
| `nav` | `/auth/register` | Create Free Account | Desktop nav (`.nav-cta`), opens in a new tab |
| `hero` | `/auth/register` | Create your free account | Hero (`.hero-cta`) |
| `messages` | `/auth/register` | Schedule (×3) | Afterlife Messages timing cards (`#messages .timing-grid`): specific date, date without a year, period of time |
| `pricing` | `/auth/register` | Start free | Free plan card (`#pricing`) |
| `pricing` | `/auth/register` | Subscribe now | Paid plan card (`#pricing`) |
| `messages-standalone` | `/auth/register` | Create a message | Standalone Afterlife Messages offer (`.standalone-right`) |
| `final-cta` | `/auth/register` | Create your free account | Closing band (`.final-cta`) |
| `final-cta` | `/auth/login` | I already have one | Closing band (`.final-cta`) |
| `mobile-sticky` | `/auth/register` | Create your free account | Mobile sticky bar (`.mobile-sticky-cta`) |
| `mobile-nav` | `/auth/login` | Login | Mobile hamburger menu (built in JS) |
| `mobile-nav` | `/auth/register` | Create Free Account | Mobile hamburger menu (built in JS) |

The footer has no signup or login links. Legal, trustee, social, mailto and
in-page links are not tagged.

`npm test` (`scripts/check-auth-links.mjs`) fails if a source account link is
missing the three tags, if the build drops or changes a query string, or if any
account link is left on this site instead of the app origin.

## Proposal only: signup attribution in the app

> **Proposal. Not built. Pending a privacy review by Sable.**

To report registrations and activations by placement, the app or backend
would need to capture the UTM tags on arrival at `/auth/register` or
`/auth/login`, carry them through signup, and store them with the new account
(for example, the first-touch `utm_campaign` on the user record). Registration
and activation could then be tied back to a campaign.

That means storing marketing attribution against a person's account, so it
needs a privacy review before anyone builds it. Open questions for that review
include what is stored, for how long, whether it is disclosed in the privacy
notice, and whether it needs consent. Until the review is done, no app or
backend work should start, and placement reporting stays at the click level.
