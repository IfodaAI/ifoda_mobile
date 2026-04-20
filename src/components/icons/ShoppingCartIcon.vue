<template>
  <svg
    class="cart-ico"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- Lucide-style shopping cart -->
    <circle cx="8" cy="21" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="21" r="1" fill="currentColor" stroke="none" />
    <path
      d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** px */
    size?: number
  }>(),
  { size: 22 }
)
</script>

<style scoped>
.cart-ico {
  display: block;
  color: currentColor;
  flex-shrink: 0;
}
</style>
