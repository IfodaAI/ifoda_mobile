<template>
  <div class="location-picker">
    <!-- Actions -->
    <div class="actions">
      <button class="action-btn primary" :class="{ loading: locating }" :disabled="locating" @click="useMyLocation">
        <svg v-if="!locating" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        <span class="spinner" v-else />
        <span>{{ locating ? 'Topilyapti...' : 'Mening joyim' }}</span>
      </button>
      <button class="action-btn ghost" @click="clearAll">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        <span>Tozalash</span>
      </button>
    </div>

    <!-- Map -->
    <div class="map-wrapper">
      <div ref="mapEl" class="map" />
      <div class="map-overlay" v-if="!hasCoords">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
        <span>Xaritada joy tanlang</span>
      </div>
    </div>

    <!-- Coords -->
    <div class="coords-row" :class="{ active: hasCoords }">
      <div class="coord-item">
        <span class="coord-label">LAT</span>
        <span class="coord-value">{{ latStr }}</span>
      </div>
      <div class="coord-divider" />
      <div class="coord-item">
        <span class="coord-label">LON</span>
        <span class="coord-value">{{ lngStr }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Geolocation } from '@capacitor/geolocation'
import * as L from 'leaflet'
// Scope the CSS to this component's chunk so map styles don't inflate the
// initial app bundle. The same import in BranchMapPreview is deduped by Vite.
import 'leaflet/dist/leaflet.css'
import { nominatimReverseGeocode } from '../utils/nominatim'

const props = defineProps<{
  lat?: string
  lng?: string
}>()

const emit = defineEmits<{
  change: [v: { lat: string; lng: string; address?: string }]
  clear: []
}>()

const mapEl = ref<HTMLDivElement | null>(null)
const locating = ref(false)

let map: L.Map | null = null
let marker: L.Marker | null = null

const DEFAULT_LAT = 41.015443
const DEFAULT_LNG = 71.629846

const latNum = computed(() => Number(props.lat))
const lngNum = computed(() => Number(props.lng))
const hasCoords = computed(() => Number.isFinite(latNum.value) && Number.isFinite(lngNum.value))

const latStr = computed(() => hasCoords.value ? latNum.value.toFixed(6) : '—')
const lngStr = computed(() => hasCoords.value ? lngNum.value.toFixed(6) : '—')

const customIcon = L.divIcon({
  className: 'lp-pin-wrap',
  html: `<div class="lp-pin"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
})

function setMarker(lat: number, lng: number) {
  if (!map) return
  const ll = L.latLng(lat, lng)
  if (!marker) {
    marker = L.marker(ll, { draggable: true, icon: customIcon })
    marker.addTo(map)
    marker.on('dragend', async () => {
      const pos = marker!.getLatLng()
      const addr = await nominatimReverseGeocode(pos.lat, pos.lng)
      emit('change', { lat: String(pos.lat), lng: String(pos.lng), address: addr ?? undefined })
    })
  } else {
    marker.setLatLng(ll)
  }
  map.setView(ll, Math.max(map.getZoom(), 15))
}

async function useMyLocation() {
  locating.value = true
  try {
    await Geolocation.requestPermissions()
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    })
    const { latitude: lat, longitude: lng } = pos.coords
    const addr = await nominatimReverseGeocode(lat, lng)
    setMarker(lat, lng)
    emit('change', { lat: String(lat), lng: String(lng), address: addr ?? undefined })
  } finally {
    locating.value = false
  }
}

function clearAll() {
  if (marker) { marker.remove(); marker = null }
  map?.setView([DEFAULT_LAT, DEFAULT_LNG], 12)
  emit('clear')
}

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value, { zoomControl: true, attributionControl: true })

  const startLat = Number.isFinite(latNum.value) ? latNum.value : DEFAULT_LAT
  const startLng = Number.isFinite(lngNum.value) ? lngNum.value : DEFAULT_LNG
  map.setView([startLat, startLng], 12)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map)

  map.on('click', async (e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng
    setMarker(lat, lng)
    const addr = await nominatimReverseGeocode(lat, lng)
    emit('change', { lat: String(lat), lng: String(lng), address: addr ?? undefined })
  })

  if (hasCoords.value) setMarker(latNum.value, lngNum.value)
  setTimeout(() => map?.invalidateSize(), 0)
})

watch([latNum, lngNum], ([la, ln]) => {
  if (!map || !Number.isFinite(la) || !Number.isFinite(ln)) return
  setMarker(la, ln)
})

onUnmounted(() => {
  try { map?.remove() } catch {}
  map = null
  marker = null
})
</script>

<style scoped>
.location-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Actions */
.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s;
  white-space: nowrap;
}

.action-btn.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.action-btn.primary:hover { filter: brightness(0.96); }
.action-btn.ghost:hover { background: rgba(15,23,42,0.05); }
.action-btn:disabled { opacity: 0.55; cursor: not-allowed; }

.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Map */
.map-wrapper {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.map {
  height: 200px;
  width: 100%;
}

.map-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(255,255,255,0.72);
  backdrop-filter: blur(2px);
  pointer-events: none;
  color: rgba(15,23,42,0.45);
  font-size: 13px;
  font-weight: 500;
}

/* Coords */
.coords-row {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(15,23,42,0.025);
  transition: border-color 0.2s;
}

.coords-row.active {
  border-color: rgba(22, 163, 74, 0.28);
  background: rgba(22, 163, 74, 0.08);
}

.coord-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
}

.coord-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(15,23,42,0.4);
}

.coord-value {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 13px;
  color: var(--color-text);
}

.coord-divider {
  width: 1px;
  height: 28px;
  background: var(--color-border);
  flex-shrink: 0;
}

:deep(.lp-pin-wrap) {
  background: transparent;
  border: none;
}

:deep(.lp-pin) {
  width: 22px;
  height: 22px;
  border-radius: 50% 50% 50% 0;
  background: var(--color-primary);
  border: 2.5px solid #fff;
  transform: rotate(-45deg);
  box-shadow: 0 2px 8px rgba(22, 163, 74, 0.35);
}
</style>