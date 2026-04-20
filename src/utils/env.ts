/**
 * Runtime environment guards.
 *
 * Philosophy: in DEV we allow sensible fallbacks so the team can run the app
 * without copying a .env file. In PROD we FAIL-FAST on misconfiguration —
 * shipping a release that silently talks to `localhost` or a LAN IP is worse
 * than the app refusing to boot.
 */

const DEV_FALLBACK_API = 'http://192.168.1.9:8000'
const DEV_FALLBACK_WS = 'ws://localhost:8000'

function required(name: string, value: unknown, devFallback: string): string {
  const v = typeof value === 'string' ? value.trim() : ''
  if (v) return v

  if (import.meta.env.PROD) {
    // Hard fail in production: don't silently ship with a dev endpoint.
    throw new Error(
      `[env] ${name} is required in production builds. ` +
        `Set it in .env.production or your CI secrets before building.`
    )
  }

  if (import.meta.env.DEV) {
    console.warn(
      `[env] ${name} is not set — falling back to "${devFallback}" for DEV only. ` +
        `Release builds will FAIL on missing ${name}.`
    )
  }

  return devFallback
}

/** Base URL for REST API (Axios). Throws in production if not configured. */
export const API_URL = required('VITE_API_URL', import.meta.env.VITE_API_URL, DEV_FALLBACK_API)

/** Base URL for WebSocket. Throws in production if not configured. */
export const WS_URL = required('VITE_WS_URL', import.meta.env.VITE_WS_URL, DEV_FALLBACK_WS)

/** Extra production-only sanity checks (cleartext protocols). */
if (import.meta.env.PROD) {
  if (API_URL.startsWith('http://')) {
    throw new Error('[env] VITE_API_URL must use https:// in production builds.')
  }
  if (WS_URL.startsWith('ws://')) {
    throw new Error('[env] VITE_WS_URL must use wss:// in production builds.')
  }
}
