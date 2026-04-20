import api from './index'
import type { User } from './types'

export interface InitAuthResponse {
  token: string
  tg_url: string
}

export interface CheckAuthResponse {
  status: 'pending' | 'success' | 'expired'
  access_token?: string
  refresh_token?: string
  user?: User
}

export interface TokenRefreshResponse {
  access: string
}

/**
 * Bot deep link init — Telegram auth boshida
 */
export async function initTelegramAuth() {
  const response = await api.post<InitAuthResponse>(
    '/api/auth/telegram/bot/init/'
  )
  return response.data
}

/**
 * Polling — JWT tayyor bo'lguncha
 */
export async function checkTelegramAuth(token: string) {
  const response = await api.get<CheckAuthResponse>(
    '/api/auth/telegram/bot/check/',
    {
      params: { token },
    }
  )
  return response.data
}

/**
 * Token yangilash
 */
export async function refreshToken(refreshToken: string) {
  const response = await api.post<TokenRefreshResponse>(
    '/api/token/refresh/',
    {
      refresh: refreshToken,
    }
  )
  return response.data
}

/**
 * Joriy user ma'lumotlari
 */
export async function getCurrentUser() {
  const response = await api.get<User>('/api/auth/me/')
  return response.data
}
