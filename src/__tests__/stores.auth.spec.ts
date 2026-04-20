import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'

describe('Auth Store', () => {
  beforeEach(() => {
    // Her test da yangi Pinia instance
    setActivePinia(createPinia())
  })

  it('initial state', () => {
    const auth = useAuthStore()

    expect(auth.accessToken).toBeNull()
    expect(auth.refreshToken).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.isLoading).toBe(false)
  })

  it('setTokens - tokenlarni saqlash', async () => {
    const auth = useAuthStore()

    await auth.setTokens('access_token_123', 'refresh_token_456')

    expect(auth.accessToken).toBe('access_token_123')
    expect(auth.refreshToken).toBe('refresh_token_456')
  })

  it('logout - token va userlarni o\'chirish', async () => {
    const auth = useAuthStore()

    // Avval token set qilsh
    await auth.setTokens('access_token_123', 'refresh_token_456')
    expect(auth.accessToken).toBe('access_token_123')

    // Logout qilish
    await auth.logout()
    expect(auth.accessToken).toBeNull()
    expect(auth.refreshToken).toBeNull()
    expect(auth.user).toBeNull()
  })
})
