<template>
  <teleport to="body">
    <div
      v-if="ui.confirmState.open"
      class="overlay"
      @click.self="ui.resolveConfirm(false)"
      role="dialog"
      aria-modal="true"
    >
      <div class="modal">
        <div class="header">
          <h2 class="title">{{ ui.confirmState.title }}</h2>
          <button class="x" type="button" @click="ui.resolveConfirm(false)" aria-label="Yopish">
            ✕
          </button>
        </div>

        <div class="body">
          <p class="msg">{{ ui.confirmState.message }}</p>
        </div>

        <div class="footer">
          <button class="btn ghost" type="button" @click="ui.resolveConfirm(false)">
            {{ ui.confirmState.cancelText }}
          </button>
          <button class="btn danger" type="button" @click="ui.resolveConfirm(true)">
            {{ ui.confirmState.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { useUiStore } from '../stores/ui'

const ui = useUiStore()
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.48);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 10000;
}

.modal {
  width: min(520px, 100%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}

.x {
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 10px;
  width: 34px;
  height: 34px;
  cursor: pointer;
}

.body {
  padding: 14px 16px;
}

.msg {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text);
}

.footer {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: #fff;
  color: var(--color-text);
}

.btn.ghost:hover {
  background: rgba(15, 23, 42, 0.04);
}

.btn.danger {
  border: 1px solid rgba(153, 27, 27, 0.20);
  background: #991b1b;
  color: #fff;
}

.btn.danger:hover {
  filter: brightness(0.98);
}
</style>

