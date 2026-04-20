import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

/**
 * Opens HTTPS URLs reliably on native (in-app browser) and web.
 */
export async function openExternalUrl(url: string): Promise<void> {
  const u = url.trim()
  if (!u) return
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url: u })
  } else {
    window.open(u, '_blank', 'noopener,noreferrer')
  }
}
