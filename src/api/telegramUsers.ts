import type { Paginated, RegionDto, DistrictDto, TelegramUserCheck } from './types'
import api from './index'

export async function fetchCheckUser(telegramId: number) {
  const { data } = await api.get<TelegramUserCheck>('/api/telegram-users/check_user/', {
    params: { telegram_id: telegramId },
  })
  return data
}

export async function fetchRegions() {
  const { data } = await api.get<Paginated<RegionDto>>('/api/regions/')
  return data.results ?? []
}

export async function fetchDistricts(regionId: string) {
  const { data } = await api.get<Paginated<DistrictDto>>('/api/districts/', {
    params: { region: regionId },
  })
  return data.results ?? []
}

/** Telegram user yozuvi ID (check_user javobidagi `id`) */
export async function patchTelegramUserProfile(
  telegramUserRowId: string,
  body: { region: string; district: string }
) {
  const { data } = await api.patch<TelegramUserCheck>(`/api/telegram-users/${telegramUserRowId}/`, body)
  return data
}
