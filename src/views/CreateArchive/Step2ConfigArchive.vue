<template>
  <div class="step-content" data-step="2">
    <div class="basic-sections">
      <!-- Archive name -->
      <ArchiveNameCard
        :model-value="archiveName"
        :title="$t('createArchive.archiveName')"
        :label="$t('createArchive.archiveName')"
        :placeholder="$t('createArchive.archiveNamePlaceholder')"
        :error-text="$t('createArchive.archiveNameError')"
        @update:model-value="$emit('update:archiveName', $event)"
      />

      <!-- Difficulty Settings -->
      <DifficultySelector
        i18n-prefix="createArchive"
        :title="$t('createArchive.difficulty')"
        :archive-difficulty="selectedDifficulty"
        :actual-difficulty="selectedActualDifficulty"
        @update:archive-difficulty="$emit('select-difficulty', $event)"
        @update:actual-difficulty="$emit('select-actual-difficulty', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import ArchiveNameCard from "@/components/archive/ArchiveNameCard.vue";
import DifficultySelector from "@/components/archive/DifficultySelector.vue";

defineProps({
  archiveName: { type: String, default: "" },
  selectedDifficulty: { type: String, default: "normal" },
  selectedActualDifficulty: { type: String, default: "normal" },
});

defineEmits(["update:archiveName", "select-difficulty", "select-actual-difficulty"]);
</script>

<style scoped>
/* ==========================================
 * 基础设置 — 同心圆角三段式布局
 *    Card: 36px(lg) → Inner: 28px(md) → 8px 递减
 * ========================================== */

/* 外层容器 */
.basic-sections {
  display: flex;
  flex-direction: column;
  gap: 26px;
  max-width: 780px;
  margin: 0 auto;
  padding: 4px;
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .basic-sections {
    max-width: 100%;
    gap: 24px;
  }
}
</style>
