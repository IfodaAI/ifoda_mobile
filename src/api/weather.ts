/**
 * Open-Meteo — API kalit talab qilmaydi.
 * @see https://open-meteo.com/en/docs
 */
export type CurrentWeather = {
  tempC: number
  wmoCode: number
  labelUz: string
}

const WMO_LABELS: Record<number, string> = {
  0: 'Ochiq osmon',
  1: 'Asosan ochiq',
  2: 'Qisman bulutli',
  3: 'Bulutli',
  45: 'Tuman',
  48: 'Tuman',
  51: 'Yengil yomg‘ir',
  53: "O'rtacha yomg'ir",
  55: "Kuchli yomg'ir",
  56: "Muzli yomg'ir",
  57: "Kuchli muzli yomg'ir",
  61: "Yomg'ir",
  63: "Yomg'ir",
  65: "Kuchli yomg'ir",
  66: "Muzli yomg'ir",
  67: "Kuchli muzli yomg'ir",
  71: "Qor",
  73: "Qor",
  75: "Kuchli qor",
  77: "Qor donalari",
  80: "Yomg'ir",
  81: "Yomg'ir",
  82: "Kuchli yomg'ir",
  85: "Qor",
  86: "Qor",
  95: "Momaqaldiroq",
  96: "Momaqaldiroq",
  99: "Kuchli momaqaldiroq",
}

function labelForCode(code: number): string {
  return WMO_LABELS[code] ?? 'Ob-havo'
}

export async function fetchOpenMeteoCurrent(lat: number, lng: number): Promise<CurrentWeather | null> {
  try {
    const u = new URL('https://api.open-meteo.com/v1/forecast')
    u.searchParams.set('latitude', String(lat))
    u.searchParams.set('longitude', String(lng))
    u.searchParams.set('current', 'temperature_2m,weather_code')
    u.searchParams.set('timezone', 'auto')
    const res = await fetch(u.toString())
    if (!res.ok) return null
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number }
    }
    const c = data.current
    if (!c || typeof c.temperature_2m !== 'number' || typeof c.weather_code !== 'number') return null
    return {
      tempC: Math.round(c.temperature_2m * 10) / 10,
      wmoCode: c.weather_code,
      labelUz: labelForCode(c.weather_code),
    }
  } catch {
    return null
  }
}
