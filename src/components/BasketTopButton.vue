<template>
  <button class="btn" type="button" @click="go" aria-label="Savat">
    <ShoppingCartIcon class="icon" :size="22" />
    <span v-if="count > 0" class="badge" aria-label="Savatdagi son">{{ count }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '../stores/cart'
import ShoppingCartIcon from './icons/ShoppingCartIcon.vue'

const router = useRouter()
const cart = useCartStore()

onMounted(async () => {
  await cart.ensureLoaded()
})

const count = computed(() => cart.totalCount)

function go() {
  router.push('/basket')
}
</script>

<style scoped>
.btn {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid var(--color-border);
  background: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  color: var(--color-text);
}

.icon {
  display: flex;
}

.badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  display: grid;
  place-items: center;
  border: 2px solid #fff;
  box-shadow: 0 6px 16px rgba(22, 163, 74, 0.25);
}
</style>

