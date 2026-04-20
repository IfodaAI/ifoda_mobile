# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
bun install          # install dependencies
bun dev              # dev server (web browser)
bun run build        # type-check + build for production
bun test:unit        # run Vitest unit tests
bun test:unit -- --run src/__tests__/foo.spec.ts  # single test file
bun lint             # oxlint then eslint (both auto-fix)
bun format           # prettier over src/

# Capacitor (native)
bunx cap sync ios    # sync web build → Xcode
bunx cap sync android
bunx cap open ios    # open Xcode
bunx cap open android
```

## Architecture

**Stack:** Vue 3 (Composition API + `<script setup>`) · Pinia · Vue Router · Axios · Capacitor 8 · Vitest

**Runtime targets:** iOS and Android native apps via Capacitor. The web build (`dist/`) is copied into the native shell — all HTTP goes through Capacitor's native HTTP plugin (bypasses WebView CORS).

### Key layers

| Layer | Path | Notes |
|---|---|---|
| API client | `src/api/index.ts` | Axios singleton; JWT Bearer injected by `setAuthToken()`; auto-refreshes on 401; toasts network/5xx errors globally |
| Stores | `src/stores/` | Pinia: `auth`, `cart`, `chat`, `products`, `ui`, `appLocation` |
| Router | `src/router/index.ts` | Auth guard loads tokens from storage on first navigation; route `meta` drives shell chrome (`showNav`, `showTopBar`, `topBarTitle`, `showTopBarBasket`) |
| Shell | `src/App.vue` | Orchestrates `TopBar`, `BottomNav`, `RegionDistrictModal`, toast/loading overlays; computes `paddingTop` for safe-area |
| Composables | `src/composables/` | `useDeepLink`, `useAppLocationProfile` (location + weather + region modal), `useResumablePolling`, `useWebSocket`, `useOnlineStatus` |

### iOS safe-area / notch handling

CSS vars defined in `App.vue` `<style>`:
- `--safe-area-inset-top` → `env(safe-area-inset-top)` (with `constant()` fallback for old WebViews)
- `--safe-top-padded` → safe-area-inset-top + 8px visual buffer for Dynamic Island

`App.vue` applies `paddingTop` via `:style="shellStyle"`:
- No TopBar: `var(--safe-top-padded)`
- With TopBar: `calc(var(--safe-top-padded) + 56px)`

`TopBar.vue` is `position: fixed; top: 0` with `height: calc(56px + var(--safe-top-padded))` and `padding-top: var(--safe-top-padded)` so its content clears the notch.

`capacitor.config.ts`: `StatusBar.overlaysWebView: true` — the native status bar overlays the WebView, so CSS safe-area vars must handle the offset (not the native bar).

### Auth flow

1. App boot: `auth.loadFromStorage()` reads tokens from `@aparajita/capacitor-secure-storage`
2. `setAuthToken()` injects token into Axios default headers
3. On 401: interceptor queues concurrent requests, calls `auth.refresh()`, replays on success, logs out on failure
4. Logout hooks registry (`onAuthLogout`) lets stores/composables register cleanup (WS disconnect, etc.)

### Environment

`VITE_API_URL` — required; validated at boot in `src/utils/env.ts`. Sentry optional via `VITE_SENTRY_DSN`.
