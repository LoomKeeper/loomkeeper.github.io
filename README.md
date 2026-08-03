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

## Deployment

GitHub Actions builds and deploys `dist` on every push to `main`. Configure the
repository's Pages source as **GitHub Actions** and add the
`VITE_STATSIG_CLIENT_API_KEY` repository secret.

Account links leave the marketing site and open the corresponding authentication
entry route on `https://app.loomkeeper.com`.
