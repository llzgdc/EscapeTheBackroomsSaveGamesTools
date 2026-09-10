<template>
  <div class="basic-sections">
    <ArchiveNameCard
      :model-value="name"
      :title="$t('editArchive.basicInfo')"
      :label="$t('editArchive.archiveName')"
      :placeholder="$t('editArchive.archiveNamePlaceholder')"
      :conflict-text="nameConflict ? $t('editArchive.nameTakenConflict', { name: nameConflict }) : ''"
      :suggestion="nameSuggestion"
      @update:model-value="$emit('update:name', $event)"
      @use-suggestion="$emit('use-suggested-name')"
    />

    <DifficultySelector
      i18n-prefix="editArchive"
      :title="$t('editArchive.difficulty')"
      :archive-difficulty="archiveDifficulty"
      :actual-difficulty="actualDifficulty"
      @update:archive-difficulty="$emit('update:archiveDifficulty', $event)"
      @update:actual-difficulty="$emit('update:actualDifficulty', $event)"
    />

    <!-- Quick Action -->
    <button type="button" class="settings-card action-card" @click="$emit('unlock-hub-doors')">
      <div class="action-card-body">
        <div class="action-card-info">
          <span class="action-card-title">
            <font-awesome-icon :icon="['fas', 'door-open']" />
            {{ $t("editArchive.unlockAllHubDoors") }}
          </span>
          <span class="action-card-desc">{{ $t("editArchive.hubDoors") }}</span>
        </div>
        <span class="action-card-arrow">
          <font-awesome-icon :icon="['fas', 'chevron-right']" />
        </span>
      </div>
    </button>
  </div>
</template>

<script setup>
import ArchiveNameCard from "@/components/archive/ArchiveNameCard.vue";
import DifficultySelector from "@/components/archive/DifficultySelector.vue";

defineProps({
  name: { type: String, default: "" },
  archiveDifficulty: { type: String, default: "normal" },
  actualDifficulty: { type: String, default: "normal" },
  // Live name-conflict state from useArchiveNameCheck (parent-owned);
  // keeping the archive's own name is never flagged as a conflict.
  nameConflict: { type: String, default: "" },
  nameSuggestion: { type: String, default: "" },
});

defineEmits([
  "update:name",
  "update:archiveDifficulty",
  "update:actualDifficulty",
  "use-suggested-name",
  "unlock-hub-doors",
]);
</script>

<style scoped>
.basic-sections {
  display: flex;
  flex-direction: column;
  gap: 26px;
  max-width: 780px;
  margin: 0 auto;
}

/* Card shared with the action card below */
.settings-card {
  background: linear-gradient(145deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border-radius: var(--radius-lg);
  padding: 24px;
  border: 1px solid var(--border-color);
  filter: drop-shadow(var(--filter-card-shadow));
  position: relative;
  transition: all var(--transition-normal) var(--ease-default);
}

/* Top sheen */
.settings-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 24px;
  right: 24px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
  pointer-events: none;
}

.settings-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  filter: drop-shadow(var(--filter-card-shadow-hover, 0 8px 32px rgba(0, 0, 0, 0.12)));
}

/* Quick action card */
.action-card {
  cursor: pointer;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--accent-color) 6%, transparent) 0%,
    var(--bg-secondary) 100%
  );
  border: 1px solid color-mix(in srgb, var(--accent-color) 12%, transparent);
  transition: all var(--transition-normal) var(--ease-default);
  /* Button reset: override default <button> styles */
  font-family: inherit;
  font-size: inherit;
  text-align: inherit;
  width: 100%;
  padding: 24px;
  outline: none;
  -webkit-user-select: none;
  user-select: none;
}

.action-card:hover {
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--accent-color) 10%, transparent) 0%,
    var(--bg-tertiary) 100%
  );
  border-color: color-mix(in srgb, var(--accent-color) 25%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.action-card:focus-visible {
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--accent-color) 25%, transparent),
    0 8px 24px rgba(0, 0, 0, 0.1);
}

.action-card:active {
  transform: translateY(0);
}

.action-card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.action-card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-card-title svg {
  color: var(--accent-color);
  font-size: 16px;
}

.action-card-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-left: 26px;
}

.action-card-arrow {
  color: var(--text-tertiary);
  font-size: 14px;
  transition: all var(--transition-normal) var(--ease-default);
  flex-shrink: 0;
}

.action-card:hover .action-card-arrow {
  color: var(--accent-color);
  transform: translateX(4px);
}

@media (max-width: 768px) {
  .basic-sections {
    max-width: 100%;
    gap: 24px;
  }
}

@media (max-width: 480px) {
  .settings-card {
    padding: 20px;
  }
}
</style>
