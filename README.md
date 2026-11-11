# Loomkeeper landing page

The React landing site for [www.loomkeeper.com](https://www.loomkeeper.com),
deployed as a static Vite build through GitHub Pages.

## Local development

```bash
nvm use
cp .env.example .env.local
npm ci
npm run dev
```

Set `VITE_APP_ORIGIN` to the Kinde-enabled web app origin. Use
`http://localhost:3000` locally and `https://app.loomkeeper.com` in production.
`VITE_API_GATEWAY` defaults to `https://localhost:7014` in `.env.example` for
local development. Production receives `https://api.loomkeeper.com` through
the `VITE_API_GATEWAY` GitHub Actions repository variable.

## Deployment

GitHub Actions builds and deploys `dist` on every push to `main`. Configure the
repository's Pages source as **GitHub Actions**.

Account links leave the landing page and open the corresponding authentication
entry route on `https://app.loomkeeper.com`. They carry UTM placement tags; see
[docs/measurement.md](docs/measurement.md).

The exported landing document is served directly as the root page. React mounts
only a hidden controller that supplies pricing and account-link routing; the visible page is not rendered inside an iframe.

## Internal locale testing

Add `?locale=es` (or `es-ES`) to the page URL to preview a translation. Supported
languages are `en`, `es`, `pl`, `fr`, and `he`; Hebrew also applies RTL layout.
Full locale codes, underscores, language names, and `iw` are accepted.
`locale=default` and `locale=reset` select English. Missing or unsupported locales
also use English. The override is URL-only and is not saved between visits.
The language switcher remains hidden.
