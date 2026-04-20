<template>
  <div class="input-wrap">
    <p v-if="uploading" class="uploading">
      Rasm yuborilmoqda<span v-if="progress != null"> ({{ progress }}%)</span>...
    </p>
    <p v-if="imageError" class="image-error">{{ imageError }}</p>

    <div class="input-area">
    <input
      v-model="text"
      type="text"
      placeholder="Xabar yozing..."
      :disabled="disabled"
      @keyup.enter="handleSendText"
      class="text-input"
    />

    <button
      class="icon-button"
      :disabled="disabled"
      @click="handlePickImage"
      aria-label="Kamera yoki galereyadan rasm tanlash"
    >
      <span aria-hidden="true">📷</span>
    </button>

    <button
      class="icon-button"
      :disabled="disabled || !text.trim()"
      @click="handleSendText"
      aria-label="Yuborish"
    >
      <span aria-hidden="true">➤</span>
    </button>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleFileSelected"
    />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { devWarn } from '../utils/devLog'
import {
  Camera,
  CameraResultType,
  CameraSource,
} from '@capacitor/camera'

defineProps<{
  disabled?: boolean
  uploading?: boolean
  progress?: number
}>()

const emit = defineEmits<{
  'send-text': [text: string]
  'send-image': [file: File]
}>()

const text = ref('')
const fileInput = ref<HTMLInputElement>()
const imageError = ref('')

const MAX_IMAGE_BYTES = 20 * 1024 * 1024

function mb(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function validateImage(file: File): boolean {
  imageError.value = ''
  if (file.size > MAX_IMAGE_BYTES) {
    imageError.value = `Rasm hajmi 20MB dan oshmasligi kerak. Hozirgi: ${mb(file.size)}MB`
    return false
  }
  return true
}

function handleSendText() {
  if (text.value.trim()) {
    emit('send-text', text.value)
    text.value = ''
  }
}

function openFileInput() {
  fileInput.value?.click()
}

function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) {
    const file = input.files[0]
    if (validateImage(file)) {
      emit('send-image', file)
    }
    input.value = ''
  }
}

async function handlePickImage() {
  // Web’da oddiy file picker
  if (!Capacitor.isNativePlatform()) {
    openFileInput()
    return
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt, // Camera yoki Gallery tanlashni so'raydi
      promptLabelHeader: 'Rasm tanlang',
      promptLabelPhoto: 'Galereyadan',
      promptLabelPicture: 'Kameradan',
      promptLabelCancel: 'Bekor qilish',
    })

    const webPath = photo.webPath
    if (!webPath) return

    const res = await fetch(webPath)
    const blob = await res.blob()
    const ext = blob.type.includes('png') ? 'png' : 'jpg'
    const file = new File([blob], `photo.${ext}`, { type: blob.type })
    if (validateImage(file)) {
      emit('send-image', file)
    }
  } catch (e) {
    // User cancel qilsa yoki permission bo'lmasa shu yerga tushadi
    devWarn('Image pick cancelled or failed:', e)
  }
}
</script>

<style scoped>
.input-wrap {
  padding: 8px 12px 12px 12px;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.uploading {
  margin: 0 0 8px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(22, 163, 74, 0.08);
  border: 1px solid rgba(22, 163, 74, 0.18);
  color: var(--color-text);
  font-size: 13px;
}

.image-error {
  margin: 0 0 8px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fef2f2;
  border: 1px solid rgba(153, 27, 27, 0.12);
  color: #991b1b;
  font-size: 13px;
}

.input-area {
  display: flex;
  gap: 8px;
}

.text-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.3s;
}

.text-input:focus {
  border-color: var(--color-primary);
}

.text-input:disabled {
  background: #f5f5f5;
  color: #999;
}

.icon-button {
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 14px;
  cursor: pointer;
  font-size: 18px;
  transition: transform 0.05s ease, background 0.2s ease, filter 0.2s ease;
}

.icon-button:hover:not(:disabled) {
  background: var(--color-primary-50);
}

.icon-button:active:not(:disabled) {
  transform: translateY(1px);
}

.icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
