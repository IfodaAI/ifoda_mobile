import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.ifoda.app',
  appName: 'Ifoda',
  webDir: 'dist',
  plugins: {
    // Route `fetch` / `XMLHttpRequest` through the native HTTP client
    // (URLSession on iOS, OkHttp on Android) instead of the WebView. Bypasses
    // browser CORS entirely — the Capacitor origin (`capacitor://localhost`
    // on iOS, `https://localhost` on Android) is not a real HTTP origin, so
    // backend CORS allowlists almost never include it and every request dies
    // with `ERR_NETWORK` before even reaching the server. Native HTTP has no
    // CORS layer, so the request goes straight through.
    //
    // Note: WebSocket is unaffected (CORS doesn't apply to WS, only the
    // server-side Origin check does — handle that in Django if needed).
    CapacitorHttp: { enabled: true },
    // iOS notch/Dynamic Island: prevent the native status bar from overlaying
    // the WebView. When it overlays, content can appear "too high" under the
    // island even if CSS safe-area padding is present (varies by iOS version,
    // WKWebView insets, and transparency). Turning overlay off makes the
    // WebView start below the status bar consistently.
    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;
