<template>
  <Teleport to="body">
    <div v-if="modelValue" class="overlay">
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="rd-title" @click.stop>
        <h2 id="rd-title" class="title">Viloyat va tuman</h2>
        <p class="hint">
          Hisobingizda hudud ko‘rsatilmagan. GPS bo‘yicha tanlangan qiymatlarni tekshiring va
          tasdiqlang.
        </p>

        <div v-if="loadError" class="err">{{ loadError }}</div>

        <label class="lbl" for="rd-region">Viloyat</label>
        <select
          id="rd-region"
          v-model="regionId"
          class="sel"
          :disabled="loadingRegions"
          @change="onRegionChange"
        >
          <option value="" disabled>{{ loadingRegions ? 'Yuklanmoqda...' : 'Tanlang' }}</option>
          <option v-for="r in regions" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>

        <label class="lbl" for="rd-district">Tuman / shahar</label>
        <select id="rd-district" v-model="districtId" class="sel" :disabled="!regionId || loadingDistricts">
          <option value="" disabled>{{ loadingDistricts ? 'Yuklanmoqda...' : 'Tanlang' }}</option>
          <option v-for="d in districts" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>

        <button class="btn primary" type="button" :disabled="saving || !canSubmit" @click="submit">
          {{ saving ? 'Saqlanmoqda...' : 'Tasdiqlash' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DistrictDto, RegionDto } from '../api/types'
import { fetchDistricts, fetchRegions, fetchCheckUser, patchTelegramUserProfile } from '../api/telegramUsers'
import { useAppLocationStore } from '../stores/appLocation'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'
import { humanizeApiError } from '../utils/errors'
import { guessDistrict, guessRegion } from '../utils/regionMatch'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const auth = useAuthStore()
const appLocation = useAppLocationStore()
const ui = useUiStore()

const regions = ref<RegionDto[]>([])
const districts = ref<DistrictDto[]>([])
const regionId = ref('')
const districtId = ref('')
const loadingRegions = ref(false)
const loadingDistricts = ref(false)
const saving = ref(false)
const loadError = ref('')

const canSubmit = computed(() => Boolean(regionId.value && districtId.value))

async function loadDistrictsAndGuess(rid: string, applyGuess: boolean) {
  loadingDistricts.value = true
  districts.value = []
  districtId.value = ''
  try {
    const list = await fetchDistricts(rid)
    districts.value = list
    if (applyGuess && appLocation.nominatim) {
      const g = guessDistrict(list, appLocation.nominatim.address, appLocation.nominatim.display_name)
      if (g) districtId.value = g
    }
  } catch (e) {
    loadError.value = humanizeApiError(e) ?? 'Tumanlar yuklanmadi.'
  } finally {
    loadingDistricts.value = false
  }
}

async function onRegionChange() {
  loadError.value = ''
  const rid = regionId.value
  if (!rid) {
    districts.value = []
    districtId.value = ''
    return
  }
  await loadDistrictsAndGuess(rid, true)
}

async function openSetup() {
  loadError.value = ''
  loadingRegions.value = true
  regions.value = []
  regionId.value = ''
  districtId.value = ''
  try {
    const list = await fetchRegions()
    regions.value = list
    const nom = appLocation.nominatim
    if (nom && list.length) {
      const gr = guessRegion(list, nom.address, nom.display_name)
      if (gr) {
        regionId.value = gr
        await loadDistrictsAndGuess(gr, true)
        return
      }
    }
  } catch (e) {
    loadError.value = humanizeApiError(e) ?? 'Viloyatlar yuklanmadi.'
  } finally {
    loadingRegions.value = false
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) void openSetup()
  }
)

async function submit() {
  const rowId = appLocation.telegramCheck?.id
  const tid = auth.user?.telegram_id
  if (!rowId || !regionId.value || !districtId.value) return
  saving.value = true
  loadError.value = ''
  try {
    const updated = await patchTelegramUserProfile(rowId, {
      region: regionId.value,
      district: districtId.value,
    })
    appLocation.setTelegramCheck(updated)
    if (tid != null) {
      const fresh = await fetchCheckUser(tid)
      appLocation.setTelegramCheck(fresh)
    }
    ui.toastOnce('region-saved', 'Hudud saqlandi.', 'info', 2400)
    emit('update:modelValue', false)
  } catch (e) {
    loadError.value = humanizeApiError(e) ?? 'Saqlashda xatolik.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.card {
  width: 100%;
  max-width: 400px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  padding: 18px 16px 16px;
}

.title {
  margin: 0 0 8px 0;
  font-size: 17px;
  font-weight: 900;
  color: var(--color-primary);
}

.hint {
  margin: 0 0 14px 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-muted);
}

.lbl {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text);
  margin: 10px 0 6px;
}

.sel {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  font-size: 14px;
  background: #fff;
  color: var(--color-text);
}

.btn {
  width: 100%;
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.btn.primary {
  background: var(--color-primary);
  color: #fff;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.err {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 13px;
}
</style>
