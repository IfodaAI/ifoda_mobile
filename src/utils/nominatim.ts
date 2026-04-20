/**
 * OpenStreetMap Nominatim reverse geocoding.
 * Uses a fixed User-Agent per Nominatim usage policy; failures return null (caller keeps lat/lng only).
 */
const NOMINATIM_UA = 'IfodaMobile/1.0 (+https://ifoda-shop.uz)'

export type NominatimStructured = {
  display_name: string | null
  address: Record<string, string>
}

export async function nominatimReverseGeocode(lat: number, lng: number): Promise<string | null> {
  const s = await nominatimReverseStructured(lat, lng)
  return s?.display_name ?? null
}

export async function nominatimReverseStructured(lat: number, lng: number): Promise<NominatimStructured | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': NOMINATIM_UA,
      },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      display_name?: string
      address?: Record<string, string>
    }
    const raw = data.address ?? {}
    const address: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string' && v.trim()) address[k] = v
    }
    return {
      display_name: typeof data.display_name === 'string' ? data.display_name : null,
      address,
    }
  } catch {
    return null
  }
}
