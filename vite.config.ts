import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

// Content Security Policy for the production build only: the dev server
// injects inline scripts for hot reload, which this policy would block.
// frame-ancestors and HSTS can't be set from a <meta> tag; send them as
// response headers from the server that hosts the build.
function securityHeaders(apiUrl: string): Plugin {
  const apiOrigin = apiUrl ? new URL(apiUrl).origin : ''
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // The API origin serves uploaded images such as tenant logos
    `img-src 'self' data: blob: ${apiOrigin}`.trim(),
    `connect-src 'self' ${apiOrigin}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  return {
    name: 'security-headers',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd())
  // The API URL is baked into the bundle and its CSP at build time. Refuse a
  // production build that would ship a missing or cleartext address (for
  // example a leftover http://localhost from .env.local).
  if (command === 'build' && process.env.ALLOW_INSECURE_API !== '1') {
    let protocol = ''
    try {
      protocol = new URL(env.VITE_API_URL).protocol
    } catch {
      // Missing or malformed: handled below
    }
    if (protocol !== 'https:') {
      throw new Error(
        `VITE_API_URL must be an https:// URL for a production build (got "${env.VITE_API_URL ?? ''}"). ` +
          'Set it in .env.production or the build environment. ' +
          'For a local test build only, set ALLOW_INSECURE_API=1.',
      )
    }
  }
  return {
    plugins: [react(), tailwindcss(), securityHeaders(env.VITE_API_URL)],
    build: {
      // Don't publish source maps with the production bundle
      sourcemap: false,
    },
  }
})
