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

Set `VITE_STATSIG_CLIENT_API_KEY` to the client key used by the web app. When
the key is omitted, the landing page remains usable with the waitlist enabled.
Set `VITE_APP_ORIGIN` to the Kinde-enabled web app origin. Use
`http://localhost:3000` locally and `https://app.loomkeeper.com` in production.
`VITE_API_GATEWAY` defaults to `https://localhost:7014` in `.env.example` for
local development. Production receives `https://api.loomkeeper.com` through
the `VITE_API_GATEWAY` GitHub Actions repository variable.

## The landing document

`public/landing-page/index.html` is the marketing page itself, loaded in an
iframe by `src/LandingPage.tsx`. It began as a single-file design-tool export
and is now edited directly — there is no generator behind it, so changes go
into that file and its `assets/` folder by hand.

A fresh export from the design tool is therefore a starting point, not a
drop-in replacement: it carries no host integration, and diffing it against the
current document is the only way to see what a designer actually changed.

## Deployment

GitHub Actions builds and deploys `dist` on every push to `main`. Configure the
repository's Pages source as **GitHub Actions** and add the
`VITE_STATSIG_CLIENT_API_KEY` repository secret.

Account links leave the landing page and open the corresponding authentication
entry route on `https://app.loomkeeper.com`.
