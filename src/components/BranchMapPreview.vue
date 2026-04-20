<template>
  <div ref="el" class="mapBox" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps<{
  latitude: number
  longitude: number
}>()

const el = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let marker: L.Marker | null = null

const pin = L.divIcon({
  className: 'bmp-pin-wrap',
  html: '<div class="bmp-pin"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
})

function sync() {
  if (!map || !Number.isFinite(props.latitude) || !Number.isFinite(props.longitude)) return
  const ll = L.latLng(props.latitude, props.longitude)
  if (!marker) {
    marker = L.marker(ll, { icon: pin })
    marker.addTo(map)
  } else {
    marker.setLatLng(ll)
  }
  map.setView(ll, 15)
}

onMounted(() => {
  if (!el.value) return
  map = L.map(el.value, {
    zoomControl: true,
    attributionControl: true,
    dragging: true,
    scrollWheelZoom: false,
  })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map)
  sync()
  setTimeout(() => map?.invalidateSize(), 100)
})

watch(
  () => [props.latitude, props.longitude] as const,
  () => {
    // Only the marker moves when coords change; the map container stays the
    // same size so there's no need to re-run the expensive invalidateSize().
    sync()
  }
)

onUnmounted(() => {
  try {
    map?.remove()
  } catch {
    /* ignore */
  }
  map = null
  marker = null
})
</script>

<style scoped>
.mapBox {
  height: 200px;
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

:deep(.bmp-pin-wrap) {
  background: transparent !important;
  border: none !important;
}

:deep(.bmp-pin) {
  width: 22px;
  height: 22px;
  border-radius: 50% 50% 50% 0;
  background: #2563eb;
  border: 3px solid #fff;
  transform: rotate(-45deg);
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.45);
}
</style>
