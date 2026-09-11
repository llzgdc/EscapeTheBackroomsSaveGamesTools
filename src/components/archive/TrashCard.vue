<template>
  <div class="trash-card" :class="{ 'is-busy': busy }">
    <div class="trash-card-head">
      <div class="trash-file-icon">
        <font-awesome-icon icon="fa-solid fa-file" aria-hidden="true" />
      </div>
      <div class="trash-title">
        <h3 class="trash-name" :title="item.name">{{ item.name }}</h3>
        <span v-if="item.difficulty" class="difficulty-chip" :class="difficultyClass">
          {{ item.difficulty }}
        </span>
      </div>
    </div>

    <div class="trash-meta">
      <span v-if="item.date" class="meta-item">
        <font-awesome-icon icon="fa-solid fa-clock" aria-hidden="true" />
        {{ item.date }}
      </span>
      <span v-if="item.mode" class="meta-item">
        <font-awesome-icon icon="fa-solid fa-user-group" aria-hidden="true" />
        {{ item.mode }}
      </span>
      <span class="meta-item">
        <font-awesome-icon icon="fa-solid fa-database" aria-hidden="true" />
        {{ formattedSize }}
      </span>
    </div>

    <div class="trash-actions">
      <button class="trash-btn restore" type="button" :disabled="busy" @click.stop="emit('restore', item)">
        <font-awesome-icon icon="fa-solid fa-rotate-left" aria-hidden="true" />
        {{ t("trash.card.restore") }}
      </button>
      <button class="trash-btn delete" type="button" :disabled="busy" @click.stop="emit('delete', item)">
        <font-awesome-icon icon="fa-solid fa-trash" aria-hidden="true" />
        {{ t("trash.card.delete") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { TrashedArchive } from "@/domain/archive/models";
import { formatFileSize } from "@/utils/formatFileSize";

defineOptions({ name: "TrashCard" });

const props = defineProps<{
  item: TrashedArchive;
  busy?: boolean;
}>();

const emit = defineEmits<{
  restore: [item: TrashedArchive];
  delete: [item: TrashedArchive];
}>();

const { t } = useI18n({ useScope: "global" });

const formattedSize = computed(() => formatFileSize(props.item.fileSize));

// Lowercase key keeps the class names stable regardless of the backend label
// casing; non-conforming files have no difficulty and render no chip.
const difficultyClass = computed(() => `diff-${props.item.difficulty.toLowerCase()}`);
</script>

<style scoped>
.trash-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition:
    transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    box-shadow 0.25s ease;
}

.trash-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.12));
}

.trash-card.is-busy {
  opacity: 0.6;
  pointer-events: none;
}

.trash-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.trash-file-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  font-size: 16px;
}

.trash-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.trash-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.difficulty-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-tag);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
}

.difficulty-chip.diff-easy {
  color: #34c759;
  background: rgba(52, 199, 89, 0.15);
  border-color: rgba(52, 199, 89, 0.4);
}

.difficulty-chip.diff-normal {
  color: #ff9500;
  background: rgba(255, 149, 0, 0.15);
  border-color: rgba(255, 149, 0, 0.4);
}

.difficulty-chip.diff-hard {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.15);
  border-color: rgba(255, 59, 48, 0.4);
}

.difficulty-chip.diff-nightmare {
  color: #af52de;
  background: rgba(175, 82, 222, 0.15);
  border-color: rgba(175, 82, 222, 0.4);
}

.trash-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.meta-item svg {
  font-size: 11px;
}

.trash-actions {
  display: flex;
  gap: 10px;
  margin-top: auto;
}

.trash-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-button);
  border: 1px solid var(--border-color);
  background: var(--btn-secondary-bg);
  color: var(--text-color);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.trash-btn svg {
  font-size: 12px;
}

.trash-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.trash-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.trash-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.trash-btn.restore:hover:not(:disabled) {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
}

.trash-btn.delete {
  color: #ff3b30;
  border-color: rgba(255, 59, 48, 0.35);
}

.trash-btn.delete:hover:not(:disabled) {
  background: rgba(255, 59, 48, 0.1);
  border-color: #ff3b30;
  color: #ff3b30;
}
</style>
