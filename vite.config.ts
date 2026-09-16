import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const landingDocument = new URL('./landing-page/index.html', import.meta.url)

const directLandingPage = () => ({
  name: 'direct-landing-page',
  transformIndexHtml: {
    order: 'pre' as const,
    handler: () => {
      const html = readFileSync(landingDocument, 'utf8').replace(
        /(["'(])assets\//g,
        '$1/landing-page/assets/',
      )

      return html
        .replace(
          '</head>',
          `    <style id="landing-host-boot">
      body:not(.landing-host-ready) > :not(#landing-host-loader):not(#landing-config-root):not(script) {
        visibility: hidden;
      }
      #landing-host-loader {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: grid;
        place-items: center;
        background: #f2f2f4;
        color: #292834;
        font-family: Manrope, system-ui, sans-serif;
      }
      .landing-host-loader-inner {
        display: grid;
        justify-items: center;
        gap: 18px;
      }
      .landing-host-loader-brand {
        font-size: 25px;
        font-weight: 700;
        letter-spacing: -0.04em;
      }
      .landing-host-loader-brand::first-letter { color: #ff3d8d; }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .landing-host-loader-bar {
        width: 120px;
        height: 3px;
        overflow: hidden;
        border-radius: 999px;
        background: #dfdce9;
      }
      .landing-host-loader-bar::after {
        content: '';
        display: block;
        width: 45%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #6c51eb, #ff3d8d);
        animation: landing-host-progress 1s ease-in-out infinite alternate;
      }
      @keyframes landing-host-progress {
        from { transform: translateX(-5%); }
        to { transform: translateX(125%); }
      }
      body.landing-host-ready #landing-host-loader { display: none; }
    </style>
  </head>`,
        )
        .replace(
          '</body>',
          `    <div id="landing-host-loader" role="status" aria-live="polite">
      <div class="landing-host-loader-inner">
        <div class="landing-host-loader-brand">Loomkeeper</div>
        <div class="landing-host-loader-bar" aria-hidden="true"></div>
        <span class="sr-only">Loading Loomkeeper</span>
      </div>
    </div>
    <div id="landing-config-root" hidden></div>
    <script type="module" src="/src/main.tsx"></script>
    <script>
      window.setTimeout(function () {
        document.body.classList.add('landing-host-ready')
      }, 3500)
    </script>
  </body>`,
        )
    },
  },
})

export default defineConfig({
  base: '/',
  plugins: [directLandingPage(), react()],
})
