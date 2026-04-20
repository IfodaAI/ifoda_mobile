import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TelegramUserCheck } from '../api/types'
import type { CurrentWeather } from '../api/weather'
import type { NominatimStructured } from '../utils/nominatim'

export const useAppLocationStore = defineStore('appLocation', () => {
  const coords = ref<{ lat: number; lng: number } | null>(null)
  const locationDenied = ref(false)
  const weather = ref<CurrentWeather | null>(null)
  const placeLabel = ref<string | null>(null)
  const nominatim = ref<NominatimStructured | null>(null)
  const telegramCheck = ref<TelegramUserCheck | null>(null)
  const showRegionModal = ref(false)
  const profileInitDone = ref(false)

  function reset() {
    coords.value = null
    locationDenied.value = false
    weather.value = null
    placeLabel.value = null
    nominatim.value = null
    telegramCheck.value = null
    showRegionModal.value = false
    profileInitDone.value = false
  }

  function setTelegramCheck(data: TelegramUserCheck) {
    telegramCheck.value = data
  }

  return {
    coords,
    locationDenied,
    weather,
    placeLabel,
    nominatim,
    telegramCheck,
    showRegionModal,
    profileInitDone,
    reset,
    setTelegramCheck,
  }
})
