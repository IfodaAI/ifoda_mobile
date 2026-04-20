# Ifoda Mobile — Audit Report (Frontend)

Date: 2026-04-18  
Scope: `ifoda-mobile/` (Vue 3 + Pinia + Capacitor + Axios + WebSocket)

## Executive summary (top 5)

1. **Token leakage risk (URLs)**: deep-link token and WS token are passed in query strings → can leak via logs, proxies, crash reports.
2. **Unsafe production fallbacks**: REST/WS default to cleartext/local endpoints if env vars are missing → misconfigured builds can ship insecure endpoints.
3. **Chat scalability bottleneck**: no virtualization + auto-scroll on append + store O(n) scans + streaming animation timers → will degrade with long histories.
4. **Map/bundle weight**: Leaflet assets are effectively “global” (CSS imported at app entry) → larger initial bundle and more runtime work on lower-end devices.
5. **HTML sanitization risk**: regex-based sanitizer for `v-html` is brittle; if description content is untrusted, XSS becomes possible.

## Codebase map (high-signal)

- **Boot**: `src/main.ts`, `src/App.vue`
- **Routing**: `src/router/index.ts`
- **API client**: `src/api/index.ts` (Axios + interceptors + refresh queue)
- **Chat**: `src/views/ChatView.vue`, `src/stores/chat.ts`, `src/composables/useWebSocket.ts`
- **Products**: `src/views/ProductsView.vue`, `src/views/ProductDetailView.vue`
- **Checkout/maps**: `src/views/BasketView.vue`, `src/components/LocationPicker.vue`, `src/components/BranchMapPreview.vue`
- **Android manifest**: `android/app/src/main/AndroidManifest.xml`

## Findings by category

### Security & privacy

#### P0 — Tokens in URLs (high severity)
- **Deep link token in query**: `ifoda://auth?token=...` parsing in `src/composables/useDeepLink.ts`
  - **Impact**: token may be captured by OS logs, analytics, screenshots, crash reports, and any URL logging.
- **WS token in query**: `.../ws/chat/{roomId}/?token=...` in `src/composables/useWebSocket.ts`
  - **Impact**: query strings can leak to logs/proxies; rotation is harder; visible in devtools.
- **Recommendation**:
  - Prefer **Authorization header** for WS if backend supports it.
  - Or use **one-time WS ticket**: deep link token → exchange to short-lived ticket → open WS without long-lived token in URL.
  - Add Sentry `beforeSend` redaction for URLs and query tokens (see below).

#### P0 — Insecure endpoint fallbacks (high severity)
- `src/api/index.ts` fallback: `http://192.168.1.9:8000`
- `src/composables/useWebSocket.ts` fallback: `ws://localhost:8000`
- **Impact**: if `VITE_API_URL` / `VITE_WS_URL` missing in a release build, app can silently use cleartext or wrong backend.
- **Recommendation**:
  - Fail-fast in production (`import.meta.env.PROD`) when env vars are missing.
  - Split env templates and CI checks for release builds.

#### P1 — Android backup enabled (medium-high severity)
- `android:allowBackup="true"` in `android/app/src/main/AndroidManifest.xml`
- **Impact**: backups can include preferences and potentially sensitive state depending on device/transport.
- **Recommendation**: set `allowBackup=false` for release unless explicitly required and audited.

#### P2 — HTML sanitizer brittleness (medium severity)
- `v-html` description in `src/views/ProductDetailView.vue` uses a minimal regex sanitizer.
- **Impact**: regex sanitizers are bypass-prone; risk increases if descriptions are user-generated or editable by untrusted parties.
- **Recommendation**: use DOMPurify (client) or server-side sanitization (preferred).

#### P2 — Sentry without explicit PII scrubbing (medium severity)
- Sentry init in `src/main.ts`.
- **Risk**: errors can capture URLs (deep links), request metadata, or other sensitive info.
- **Recommendation**: implement `beforeSend` to strip query strings / redact tokens / phone numbers.

---

### Reliability & correctness

#### P1 — Double-toasts and noisy UX
- Network/5xx toasts in Axios interceptor (`src/api/index.ts`) and also per-view `catch` toasts (e.g. `src/views/ChatView.vue`).
- **Impact**: multiple toasts for one failure, inconsistent messaging.
- **Recommendation**: pick a single “owner” for user-facing network/server errors (interceptor or call site).

#### P1 — WebSocket reconnect strategy gaps
- Exists: exponential backoff (cap 15s) in `src/composables/useWebSocket.ts`.
- Gaps:
  - no **jitter** (risk of thundering herd after outage),
  - no **heartbeat/stale detection**,
  - token passed in URL, reconnect continues with last token,
  - connect can be called with empty token in `ChatView`.
- **Recommendation**: jittered backoff, heartbeat, token-aware reconnect; reconnect on app resume.

#### P2 — Telegram polling aggressiveness under failure
- Fixed 3s polling for up to ~5 min in `src/views/LoginView.vue`.
- **Impact**: backend hammering during outages; user waiting with limited guidance.
- **Recommendation**: backoff after repeated failures; pause polling when offline.

#### P2 — State consistency on auth lifecycle
- Logout/reset handled in views; interceptor also logs out on refresh failure.
- **Risk**: WS may stay connected with stale token; partial resets.
- **Recommendation**: centralize auth lifecycle hooks (on logout/refresh-fail: disconnect WS + reset chat).

---

### Performance & scalability

#### P1 — Chat will slow down with long histories
- `src/views/ChatView.vue` renders full list (`v-for`) without virtualization.
- Auto-scroll watcher on `messages.length` scrolls on every append.
- `src/stores/chat.ts` streaming update uses `findIndex` + fallback reverse scan; dedupe scans.
- `src/components/MessageBubble.vue` streaming “typewriter” uses frequent reactive updates.
- **Impact**: jank, memory growth, slow scroll, battery drain.
- **Recommendations**:
  - Add windowing (render last N messages, load older on demand) or virtualization.
  - Maintain an `id -> index` map in store for O(1) lookups.
  - Throttle scroll handler work and avoid scroll-to-bottom if user scrolled up.
  - Ensure only one bubble runs typing timer (already likely, but keep invariant).

#### P1 — Leaflet increases bundle weight and runtime cost
- Leaflet CSS imported in `src/main.ts` keeps map styles in core.
- Map components call `invalidateSize()` via timers.
- **Impact**: larger initial load; expensive layout on map displays.
- **Recommendations**:
  - Lazy-load map components and move Leaflet CSS import into those chunks.
  - Reduce `invalidateSize()` calls; call once per open/resize.

#### P1 — Products list does expensive regex conversion per card
- `descPreview()` + `htmlToText()` regexes used in render path in `src/views/ProductsView.vue`.
- **Impact**: CPU cost grows with items and rerenders (search/category change).
- **Recommendations**:
  - Cache preview per product id, or compute once when data arrives.
  - Prefer backend-provided short description field.

## Quick wins (1–2 hours each)

- **Add build-time guardrails**: throw in production if `VITE_API_URL` / `VITE_WS_URL` missing.
- **Add jitter** to WS backoff.
- **Cap chat rendering** (e.g., keep last 300 messages in-memory for UI; older pages still retrievable).
- **Cache product preview text**.
- **Disable Android backups in release** (or document why allowed).

## Risk matrix (top 10)

| Priority | Risk | Impact | Likelihood | Primary files |
|---|---|---:|---:|---|
| P0 | Tokens in deep-link URLs | High | Medium | `src/composables/useDeepLink.ts` |
| P0 | WS token in query string | High | Medium | `src/composables/useWebSocket.ts` |
| P0 | HTTP/WS dev fallbacks ship by mistake | High | Medium | `src/api/index.ts`, `src/composables/useWebSocket.ts` |
| P1 | Chat perf degradation with history | High | High | `src/views/ChatView.vue`, `src/stores/chat.ts` |
| P1 | Leaflet inflates bundle/CPU | Medium | High | `src/main.ts`, map components |
| P1 | Android allowBackup enabled | Medium | Medium | `android/.../AndroidManifest.xml` |
| P1 | WS reconnect herd/no heartbeat | Medium | Medium | `src/composables/useWebSocket.ts` |
| P2 | Regex sanitizer bypass (XSS) | High | Low→Medium (depends on content trust) | `src/views/ProductDetailView.vue` |
| P2 | Double-toasts / noisy error UX | Medium | Medium | `src/api/index.ts`, views |
| P2 | Polling without backoff | Medium | Medium | `src/views/LoginView.vue` |

## Remediation roadmap (suggested)

### Phase 1 (1–2 days) — ship-hardening
- Fail-fast env guardrails for production endpoints.
- Remove/limit token-in-URL surfaces (deep link + WS) via server-supported alternative.
- Set Android `allowBackup=false` for release.
- Add Sentry `beforeSend` redactions for URLs/PII.

### Phase 2 (2–4 days) — chat scalability
- Windowing/virtualization + store indexing (`id -> index`) for streaming updates.
- Improve WS reliability: jittered backoff, heartbeat, reconnect-on-resume, token-aware reconnect.
- Reduce UI work: avoid unconditional scroll-to-bottom.

### Phase 3 (2–5 days) — perf polish
- Lazy-load Leaflet + move CSS import.
- Cache product description previews; reduce regex work per render.
- Review map invalidation timers and reverse-geocode frequency limits.

## Notes / assumptions
- Backend capabilities (WS headers, one-time tickets, deep-link token exchange) determine the best fix for token-in-URL risks.
- XSS risk severity depends on who can author `product.description`.

