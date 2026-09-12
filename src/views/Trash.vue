<template>
  <div class="trash-container">
    <div class="trash-list-container" :class="{ 'is-refreshing': refreshing }">
      <!-- Page header: title + count + actions -->
      <header class="trash-header">
        <div class="header-left">
          <font-awesome-icon icon="fa-solid fa-trash-can" class="header-icon" aria-hidden="true" />
          <h1 class="header-title">{{ $t("trash.title") }}</h1>
          <span v-if="!loading" class="count-badge">{{ trashedArchives.length }}</span>
        </div>
        <div class="header-actions">
          <button class="header-btn" type="button" :disabled="loading || isEmptying" @click="handleRefresh">
            <font-awesome-icon icon="fa-solid fa-refresh" aria-hidden="true" />
            {{ $t("trash.refresh") }}
          </button>
          <button
            class="header-btn danger"
            type="button"
            :disabled="loading || isEmptying || trashedArchives.length === 0"
            @click="showEmptyTrashConfirm = true"
          >
            <font-awesome-icon icon="fa-solid fa-trash" aria-hidden="true" />
            {{ $t("trash.emptyTrash") }}
          </button>
        </div>
      </header>

      <!-- Emptying progress -->
      <div v-if="isEmptying" class="emptying-bar">
        <div class="emptying-track">
          <div class="emptying-fill" :style="{ width: emptyingPercent + '%' }"></div>
        </div>
        <span class="emptying-text"> {{ emptyProgress.current }} / {{ emptyProgress.total }} </span>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <span class="spinner-text">{{ $t("common.loading") }}</span>
        </div>
      </div>

      <!-- Trash grid -->
      <template v-else>
        <div v-if="trashedArchives.length > 0" class="trash-grid">
          <TrashCard
            v-for="item in trashedArchives"
            :key="item.originalPath"
            :item="item"
            :busy="mutatingPath === item.originalPath || isEmptying"
            @restore="handleRestoreClick"
            @delete="handleDeleteClick"
          />
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <EmptyState
            variant="welcome"
            :icon="['fas', 'trash-can']"
            :title="$t('trash.empty.title')"
            :description="$t('trash.empty.description')"
          />
        </div>
      </template>
    </div>

    <!-- Permanent delete confirmation -->
    <Teleport to="body">
      <ConfirmModal
        v-model:show="showDeleteConfirm"
        class="trash-confirm"
        :title="$t('trash.delete.confirmTitle')"
        :message="$t('trash.delete.confirmMessage', { name: itemToDelete?.name ?? '' })"
        :description="$t('trash.delete.confirmDescription')"
        type="danger"
        :confirm-text="$t('trash.delete.confirm')"
        :cancel-text="$t('confirmModal.cancel')"
        @confirm="confirmPermanentDelete"
        @cancel="showDeleteConfirm = false"
      />
    </Teleport>

    <!-- Empty-bin confirmation -->
    <Teleport to="body">
      <ConfirmModal
        v-model:show="showEmptyTrashConfirm"
        class="trash-confirm"
        :title="$t('trash.emptyTrashConfirm.title')"
        :message="$t('trash.emptyTrashConfirm.message', { count: trashedArchives.length })"
        :description="$t('trash.emptyTrashConfirm.description')"
        type="danger"
        :confirm-text="$t('trash.emptyTrashConfirm.confirm')"
        :cancel-text="$t('confirmModal.cancel')"
        :loading="isEmptying"
        @confirm="confirmEmptyTrash"
        @cancel="cancelEmptyTrash"
      />
    </Teleport>

    <!-- Restore-overwrite confirmation: a live archive with the same name exists -->
    <Teleport to="body">
      <ConfirmModal
        v-model:show="showOverwriteConfirm"
        class="trash-confirm"
        :title="$t('trash.restore.conflictTitle')"
        :message="$t('trash.restore.conflictMessage', { name: itemToRestore?.name ?? '' })"
        :description="$t('trash.restore.conflictDescription')"
        type="warning"
        :confirm-text="$t('trash.restore.conflictConfirm')"
        :cancel-text="$t('confirmModal.cancel')"
        @confirm="confirmOverwriteRestore"
        @cancel="showOverwriteConfirm = false"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from "vue";
import TrashCard from "@/components/archive/TrashCard.vue";
import ConfirmModal from "@/components/modal/ConfirmModal.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { useTrashArchive } from "@/composables/useTrashArchive";
import type { TrashedArchive } from "@/domain/archive/models";
import scheduler from "@/services/resourceScheduler";

// Explicit name so the router-view keep-alive include list can match it.
defineOptions({ name: "Trash" });

const {
  trashedArchives,
  loading,
  mutatingPath,
  isEmptying,
  emptyProgress,
  loadTrash,
  restoreArchive,
  permanentDeleteArchive,
  emptyTrash,
} = useTrashArchive();

const refreshing = ref(false);
const showDeleteConfirm = ref(false);
const showEmptyTrashConfirm = ref(false);
const showOverwriteConfirm = ref(false);
const itemToDelete = ref<TrashedArchive | null>(null);
const itemToRestore = ref<TrashedArchive | null>(null);

const emptyingPercent = computed(() => {
  if (emptyProgress.value.total === 0) return 0;
  return Math.round((emptyProgress.value.current / emptyProgress.value.total) * 100);
});

const handleRefresh = async (): Promise<void> => {
  refreshing.value = true;
  try {
    scheduler.beginOperation("loading-archives");
    await loadTrash();
  } finally {
    scheduler.endOperation("loading-archives");
    refreshing.value = false;
  }
};

const handleRestoreClick = async (item: TrashedArchive): Promise<void> => {
  const outcome = await restoreArchive(item);
  if (outcome.status === "conflict") {
    // A live archive with the same name exists — ask before clobbering it.
    itemToRestore.value = item;
    showOverwriteConfirm.value = true;
  }
};

const confirmOverwriteRestore = async (): Promise<void> => {
  const item = itemToRestore.value;
  showOverwriteConfirm.value = false;
  itemToRestore.value = null;
  if (!item) return;
  await restoreArchive(item, true);
};

const handleDeleteClick = (item: TrashedArchive): void => {
  itemToDelete.value = item;
  showDeleteConfirm.value = true;
};

const confirmPermanentDelete = async (): Promise<void> => {
  const item = itemToDelete.value;
  showDeleteConfirm.value = false;
  itemToDelete.value = null;
  if (!item) return;
  await permanentDeleteArchive(item);
};

const confirmEmptyTrash = async (): Promise<void> => {
  await emptyTrash();
};

const cancelEmptyTrash = (): void => {
  // Not abortable mid-run; the modal just stops being dismissable while
  // isEmptying, so this only fires before the run starts.
  showEmptyTrashConfirm.value = !isEmptying.value;
};

onMounted(() => {
  scheduler.beginOperation("loading-archives");
  loadTrash().finally(() => {
    scheduler.endOperation("loading-archives");
  });
});

// Refresh silently on keep-alive re-entry: deletions may have happened on
// the Home page while this view stayed cached.
onActivated(() => {
  if (!loading.value && !isEmptying.value) {
    loadTrash();
  }
});
</script>

<style scoped>
.trash-container {
  position: relative;
  height: 100%;
  width: 100%;
  background: var(--bg-primary);
}

.trash-list-container {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-primary);
  padding: 20px 24px;
  box-sizing: border-box;
  margin: 16px;
  border-radius: var(--radius-xl);
  contain: paint;
  -webkit-overflow-scrolling: touch;
}

.trash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.header-icon {
  font-size: 20px;
  color: var(--primary);
}

.header-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-button);
  border: 1px solid var(--border-color);
  background: var(--btn-secondary-bg);
  color: var(--text-color);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.header-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.header-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.header-btn.danger {
  color: #ff3b30;
  border-color: rgba(255, 59, 48, 0.35);
}

.header-btn.danger:hover:not(:disabled) {
  background: rgba(255, 59, 48, 0.1);
  border-color: #ff3b30;
  color: #ff3b30;
}

/* Emptying progress bar */
.emptying-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.emptying-track {
  flex: 1;
  height: 8px;
  background: var(--bg-secondary);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.emptying-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff3b30, #ff6b6b);
  border-radius: var(--radius-pill);
  transition: width 0.3s ease;
}

.emptying-text {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Card grid */
.trash-grid {
  display: grid;
  gap: 20px;
  width: 100%;
  box-sizing: border-box;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  animation: cards-fade-in 0.25s ease-out both;
}

@keyframes cards-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.trash-list-container.is-refreshing .trash-grid {
  opacity: 0.45;
  transform: scale(0.97);
}

.trash-grid {
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Loading state */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 240px);
  width: 100%;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--text-tertiary);
}

.spinner-ring {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: var(--radius-circle);
  animation: spinner-rotate 0.8s linear infinite;
}

.spinner-text {
  font-size: 14px;
  font-weight: 500;
}

@keyframes spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

/* Empty state */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 240px);
  padding: 48px 24px;
  width: 100%;
}

/* Danger confirm modals must cover the FAB */
.trash-confirm {
  z-index: 10001 !important;
}

.trash-list-container::-webkit-scrollbar {
  width: 8px;
}

.trash-list-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-pill);
}

.trash-list-container::-webkit-scrollbar-thumb {
  background: var(--primary-color);
  border-radius: var(--radius-pill);
}

@media (max-width: 768px) {
  .trash-grid {
    gap: 16px;
  }
}

@media (max-width: 480px) {
  .trash-grid {
    gap: 12px;
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .trash-grid {
    transition: none;
    animation: none;
  }
}
</style>
