<template>
  <div v-if="parseError" class="edit-archive-container">
    <div class="error-state">
      <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="error-icon" />
      <h2 class="error-title">{{ $t("editArchive.parseFailed") }}</h2>
      <p class="error-desc">{{ $t("editArchive.parseFailedDataInvalid") }}</p>
      <button class="btn-primary" @click="closeEdit">
        <font-awesome-icon :icon="['fas', 'home']" />
        {{ $t("errorBoundary.goHome") }}
      </button>
    </div>
  </div>
  <div v-else class="edit-archive-container">
    <!-- Top title bar + tab navigation -->
    <div class="page-header">
      <h1 class="page-title">{{ $t("editArchive.title") }}</h1>

      <div class="tab-nav">
        <div class="tab-highlight" :style="highlightStyle"></div>
        <button
          v-for="(tab, index) in tabs"
          :key="tab.id"
          :ref="(el) => (tabRefs[index] = el)"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="switchTab(tab.id, index)"
        >
          <font-awesome-icon :icon="tab.icon" />
          <span>{{ $t(tab.label) }}</span>
        </button>
      </div>

      <div class="header-actions">
        <button class="btn-secondary" @click="closeEdit">
          <font-awesome-icon :icon="['fas', 'times']" />
          {{ $t("common.cancel") }}
        </button>
        <button class="btn-primary" :disabled="isSaving" @click="handleSaveArchive">
          <font-awesome-icon v-if="!isSaving" :icon="['fas', 'save']" />
          <span v-else class="save-spinner"></span>
          {{ isSaving ? $t("editArchive.saving") : $t("common.save") }}
        </button>
      </div>
    </div>

    <!-- Content area. All three panels stay mounted (CSS class switching)
         so tab state survives switching, as before the split. -->
    <div class="tab-content" :class="`slide-${slideDirection}`">
      <div class="tab-panel" :class="{ 'tab-active': activeTab === 'basic' }">
        <BasicTab
          v-model:name="formData.name"
          v-model:archive-difficulty="formData.archiveDifficulty"
          v-model:actual-difficulty="formData.actualDifficulty"
          :name-conflict="nameConflict"
          :name-suggestion="suggestedName"
          @use-suggested-name="useSuggestedName"
          @unlock-hub-doors="unlockAllHubDoors"
        />
      </div>

      <div class="tab-panel" :class="{ 'tab-active': activeTab === 'level' }">
        <LevelTab v-model:current-level="formData.currentLevel" />
      </div>

      <div class="tab-panel" :class="{ 'tab-active': activeTab === 'players' }">
        <PlayerTab
          :players="formData.players"
          :active-player-index="activePlayerIndex"
          :new-steam-id="newSteamId"
          :player-input-message="playerInputMessage"
          :player-input-message-type="playerInputMessageType"
          @update:new-steam-id="newSteamId = $event"
          @add-steam-id="addPlayer"
          @remove-player="removePlayer"
          @select-player="selectPlayer"
          @edit-slot="editSlot"
          @sanity-change="onSanityChange"
          @steam-id-change="onSteamIdChange"
        />
      </div>
    </div>

    <!-- Name-conflict resolution: offered instead of failing the save -->
    <ConfirmModal
      :show="nameConflictModal.visible"
      type="warning"
      :title="$t('editArchive.nameTakenTitle')"
      :message="$t('editArchive.nameTakenConflict', { name: nameConflictModal.name })"
      :description="$t('editArchive.nameTakenSuggestion', { suggestion: nameConflictModal.suggestion })"
      :confirm-text="$t('editArchive.useSuggestedAndSave', { suggestion: nameConflictModal.suggestion })"
      :cancel-text="$t('common.cancel')"
      @update:show="nameConflictModal.visible = $event"
      @confirm="resolveNameConflict(true)"
      @cancel="resolveNameConflict(false)"
    />

    <!-- Item selector -->
    <InventoryItemSelector
      :visible="showItemSelector"
      :selected-item="selectedItem"
      @select="handleItemSelect"
      @update:visible="showItemSelector = $event"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import InventoryItemSelector from "@/components/feature/InventoryItemSelector.vue";
import ConfirmModal from "@/components/modal/ConfirmModal.vue";
import BasicTab from "./tabs/BasicTab.vue";
import LevelTab from "./tabs/LevelTab.vue";
import PlayerTab from "./tabs/PlayerTab.vue";
import { notify } from "@/services/notificationService";
import { editArchiveDataStore } from "@/composables/useArchiveActions";
import { useArchiveNameCheck } from "@/composables/useArchiveNameCheck";
import { detectDuplicateNameError } from "@/domain/archive/nameConflict";
import { tauriArchiveAdapter } from "@/adapters/tauri/archiveAdapter";
import { formatDifficulty } from "@/utils/archiveCreationUtils";
import { stripSteamIdSuffix } from "@/utils/steamIdUtils";
import { getItemIdByName } from "@/utils/itemIdMap";
import { FEATURES } from "@/config/features";

const props = defineProps({
  archiveData: { type: String, default: "" },
});

const { t } = useI18n({ useScope: "global" });
const router = useRouter();

// Tab configuration
const tabs = [
  { id: "basic", label: "editArchive.tabs.basic", icon: ["fas", "cog"] },
  { id: "level", label: "editArchive.tabs.level", icon: ["fas", "map"] },
  { id: "players", label: "editArchive.tabs.players", icon: ["fas", "users"] },
];
const activeTab = ref("basic");
const tabRefs = ref([]);
const highlightStyle = ref({});

// Switch tabs
const currentTabIndex = ref(0);
const slideDirection = ref("right");

const switchTab = (tabId, index) => {
  slideDirection.value = index > currentTabIndex.value ? "right" : "left";
  currentTabIndex.value = index;
  activeTab.value = tabId;
  updateHighlight(index);
};

// Update highlight position
const updateHighlight = (index) => {
  nextTick(() => {
    const btn = tabRefs.value[index];
    if (btn) {
      highlightStyle.value = {
        width: `${btn.offsetWidth}px`,
        transform: `translateX(${btn.offsetLeft - 6}px)`,
      };
    }
  });
};

// Initialize highlight position
const initHighlight = () => {
  const index = tabs.findIndex((t) => t.id === activeTab.value);
  if (index !== -1) updateHighlight(index);
};

// Form data
const formData = reactive({
  name: "",
  currentLevel: "Level0",
  gameMode: "multiplayer",
  archiveDifficulty: "normal",
  actualDifficulty: "normal",
  players: [],
});

const originalArchive = ref(null);
const newSteamId = ref("");
const activePlayerIndex = ref(-1);
const playerInputMessage = ref("");
const playerInputMessageType = ref("");
const showItemSelector = ref(false);
const editingSlot = ref({ playerIndex: -1, slotIndex: -1 });
const selectedItem = computed(() => {
  const { playerIndex, slotIndex } = editingSlot.value;
  const item = formData.players?.[playerIndex]?.inventory?.[slotIndex];
  if (!item || item === "None") return null;
  return item;
});
const parseError = ref(false);
const isSaving = ref(false);

// Live name-conflict check while editing (Basic tab). The archive's own .sav
// is excluded, so keeping the current name never counts as a conflict.
const { nameConflict, suggestedName, scheduleCheck: scheduleNameCheck, reset: resetNameCheck } = useArchiveNameCheck();

watch(
  [() => formData.name, () => formData.archiveDifficulty, originalArchive],
  () => {
    if (!originalArchive.value?.path) {
      resetNameCheck();
      return;
    }
    scheduleNameCheck(formData.name, formatDifficulty(formData.archiveDifficulty), originalArchive.value.path);
  },
  { immediate: true },
);

const useSuggestedName = () => {
  if (suggestedName.value) {
    formData.name = suggestedName.value;
  }
};

// Save-time conflict resolution (race / fast-typing edge): offer the
// suggested rename instead of failing with a raw backend error.
const nameConflictModal = reactive({ visible: false, name: "", suggestion: "" });
let nameConflictResolver = null;

const resolveNameConflict = (useSuggestion) => {
  nameConflictModal.visible = false;
  nameConflictResolver?.(useSuggestion);
  nameConflictResolver = null;
};

const askToUseSuggestedName = (name, suggestion) =>
  new Promise((resolve) => {
    nameConflictResolver = (useSuggestion) => resolve(useSuggestion ? suggestion : null);
    nameConflictModal.name = name;
    nameConflictModal.suggestion = suggestion;
    nameConflictModal.visible = true;
  });

// Save immediately — no confirmation dialog
const handleSaveArchive = () => {
  confirmSaveArchive();
};

// Confirm and execute save
const confirmSaveArchive = async () => {
  try {
    isSaving.value = true;

    if (!originalArchive.value) return;

    // Pre-flight conflict check: instead of letting the backend reject with a
    // dead-end error, offer to save under the suggested free name. The
    // archive's own path is excluded — keeping its name is never a conflict.
    const nameCheck = await tauriArchiveAdapter.checkArchiveName(
      formData.name,
      formatDifficulty(formData.archiveDifficulty),
      originalArchive.value.path,
    );
    if (nameCheck.success && nameCheck.data && !nameCheck.data.available) {
      const suggestion = nameCheck.data.suggestion;
      if (!suggestion) {
        notify.error(t("editArchive.nameTakenConflict", { name: formData.name }));
        return;
      }
      const approvedName = await askToUseSuggestedName(formData.name, suggestion);
      if (!approvedName) return;
      formData.name = approvedName;
    }

    const playerInventory = {};
    const playerSanity = {};

    formData.players.forEach((player) => {
      // Preserve the original UniqueNetId suffix written by the game when the
      // id was not edited; use the edited id otherwise.
      const originalBase = player.originalSteamId ? stripSteamIdSuffix(player.originalSteamId).split("-")[0] : "";
      const steamId =
        player.originalSteamId && originalBase === player.steamId.trim()
          ? player.originalSteamId
          : player.steamId.trim();
      playerInventory[steamId] = player.inventory.map((itemId) => ({
        item: { id: getItemIdByName(itemId) },
      }));
      playerSanity[steamId] = player.sanity ?? 100;
    });

    const saveData = {
      path: originalArchive.value.path,
      name: formData.name,
      mode: "Multiplayer",
      currentLevel: formData.currentLevel,
      difficulty: formatDifficulty(formData.archiveDifficulty),
      actualDifficulty: formatDifficulty(
        FEATURES.MERGE_DIFFICULTY ? formData.archiveDifficulty : formData.actualDifficulty,
      ),
      playerInventory,
      playerSanity,
    };

    const outputDir = (await invoke("get_local_appdata")) + "\\EscapeTheBackrooms\\Saved\\SaveGames";
    await invoke("handle_edit_save", {
      jsonInput: { saveData: { jsonData: saveData, outputDir } },
    });

    notify.success(t("editArchive.saveSuccess"));
    router.push({ name: "Home" });
  } catch (error) {
    const errorMsg = error?.message || String(error);
    console.error("Save failed:", error);

    // Duplicate-name rejections get an actionable localized message.
    const duplicate = detectDuplicateNameError(error);
    if (duplicate) {
      notify.error(t("editArchive.nameTakenConflict", { name: duplicate.archiveName || formData.name }));
    } else if (
      errorMsg.includes("锟杰撅拷锟斤拷锟斤拷") ||
      errorMsg.includes("Access is denied") ||
      errorMsg.includes("os error 5")
    ) {
      notify.error(t("editArchive.saveErrorAccessDenied"));
    } else if (errorMsg.includes("锟斤拷锟斤拷使锟斤拷") || errorMsg.includes("being used")) {
      notify.error(t("editArchive.saveErrorFileInUse"));
    } else {
      notify.error(t("editArchive.saveError", { error: errorMsg }));
    }
  } finally {
    isSaving.value = false;
  }
};

// Initialize
const initArchiveData = () => {
  try {
    if (props.archiveData) {
      let data;

      // Try lookup from editArchiveDataStore first (key-based)
      const stored = editArchiveDataStore.get("current");
      if (stored) {
        try {
          data = JSON.parse(stored);
        } catch (e) {
          console.error("Failed to read stored archive data:", e);
        }
        // Clean up store entry
        editArchiveDataStore.delete("current");
      }

      // If store lookup failed, try direct JSON parse (backward compatibility)
      if (!data) {
        try {
          data = JSON.parse(props.archiveData);
        } catch (parseErr) {
          console.error("Archive data parse failed:", parseErr);
          notify.error(t("editArchive.parseFailed") + " " + parseErr.message);
          parseError.value = true;
          return;
        }
      }

      if (!data || typeof data !== "object") {
        console.error("Archive data format invalid");
        notify.error(t("editArchive.parseFailedDataInvalid"));
        parseError.value = true;
        return;
      }

      originalArchive.value = data;
      formData.name = data.name || "";
      formData.currentLevel = data.currentLevel || "Level0";
      formData.gameMode = "multiplayer";
      formData.archiveDifficulty = data.archiveDifficulty || "normal";
      formData.actualDifficulty = FEATURES.MERGE_DIFFICULTY
        ? formData.archiveDifficulty
        : data.actualDifficulty || "normal";
      loadPlayerData(data);
    }
  } catch (e) {
    console.error("Archive data init failed:", e);
    notify.error(t("editArchive.parseFailed") + " " + (e.message || e));
    parseError.value = true;
  }
};

const loadPlayerData = async (archive) => {
  try {
    const playerData = await invoke("get_player_data", { filePath: archive.path });
    if (playerData?.ids && playerData?.inventories) {
      formData.players = [];
      playerData.ids.forEach((steamId, index) => {
        if (steamId?.trim()) {
          const inventory = playerData.inventories[index] || [];
          const formattedInventory = inventory.map((item) => item || null);
          while (formattedInventory.length < 12) formattedInventory.push(null);

          let processedId;
          let isOffline = false;
          let username = null;

          if (steamId.includes("-")) {
            const parts = steamId.split("-");
            processedId = parts[0];
            isOffline = true;
            username = `${parts[0]}${t("common.localPlayerSuffix")}`;
          } else {
            // UE UniqueNetId suffix is stripped for online ids
            processedId = stripSteamIdSuffix(steamId);
          }

          formData.players.push({
            // Display/edit id
            steamId: processedId,
            // Archive-original id (may carry the UniqueNetId suffix written by the game)
            originalSteamId: steamId,
            inventory: formattedInventory.slice(0, 12),
            username,
            isOfflinePlayer: isOffline,
            sanity: playerData.sanities[index] ?? 100,
          });
        }
      });
      if (formData.players.length > 0) {
        activePlayerIndex.value = 0;
      }
    }
  } catch (error) {
    console.error("Load player data failed:", error);
  }
};

// Player related
let messageTimeout = null;

const addPlayer = async () => {
  playerInputMessage.value = "";
  const steamId = newSteamId.value.trim();
  if (!steamId) {
    showMessage(t("editArchive.steamIdRequired"), "error");
    return;
  }

  const validation = validateSteamId(steamId);
  if (!validation.valid) {
    showMessage(validation.message, "error");
    return;
  }

  if (formData.players.some((p) => p.steamId === validation.processedSteamId)) {
    showMessage(t("editArchive.steamIdDuplicate", { steamId: validation.processedSteamId }), "error");
    return;
  }

  const newPlayer = {
    steamId: validation.processedSteamId,
    inventory: Array(12).fill(null),
    username: validation.isOfflinePlayer ? `${validation.processedSteamId}${t("common.localPlayerSuffix")}` : null,
    isOfflinePlayer: validation.isOfflinePlayer,
    sanity: 100,
  };

  formData.players.push(newPlayer);
  showMessage(t("editArchive.playerAddedSuccess"), "success");
  newSteamId.value = "";
  activePlayerIndex.value = formData.players.length - 1;
};

const showMessage = (msg, type) => {
  playerInputMessage.value = msg;
  playerInputMessageType.value = type;
  if (messageTimeout) clearTimeout(messageTimeout);
  messageTimeout = setTimeout(() => {
    playerInputMessage.value = "";
  }, 3000);
};

const validateSteamId = (steamId) => {
  if (!steamId) return { valid: false, message: t("editArchive.steamIdRequired") };
  if (steamId.includes("-")) {
    const parts = steamId.split("-");
    if (parts.length === 2 && parts[0].length === 5 && parts[1].length === 15) {
      return { valid: true, isOfflinePlayer: true, processedSteamId: parts[0] };
    }
    return { valid: false, message: t("editArchive.steamIdInvalid") };
  }
  if (!/^\d+$/.test(steamId)) return { valid: false, message: t("editArchive.steamIdInvalid") };
  if (steamId.length !== 17) return { valid: false, message: t("editArchive.steamIdLengthError") };
  return { valid: true, isOfflinePlayer: false, processedSteamId: steamId };
};

const removePlayer = (index) => {
  formData.players.splice(index, 1);
  if (activePlayerIndex.value >= formData.players.length) {
    activePlayerIndex.value = formData.players.length - 1;
  }
};

const selectPlayer = (index) => {
  activePlayerIndex.value = index;
};

// PlayerDetailPanel reports the clamped sanity value for the active player
const onSanityChange = ({ playerIndex, sanity }) => {
  if (formData.players[playerIndex]) {
    formData.players[playerIndex].sanity = sanity;
  }
};

// Steam id edited in the detail header
const onSteamIdChange = ({ playerIndex, steamId }) => {
  if (formData.players[playerIndex]) {
    formData.players[playerIndex].steamId = steamId;
  }
};

const editSlot = (playerIndex, slotIndex) => {
  editingSlot.value = { playerIndex, slotIndex };
  showItemSelector.value = true;
};

const handleItemSelect = (itemId) => {
  const { playerIndex, slotIndex } = editingSlot.value;
  if (formData.players[playerIndex]) {
    formData.players[playerIndex].inventory[slotIndex] = itemId;
  }
  showItemSelector.value = false;
};

const closeEdit = () => router.push({ name: "Home" });

// Unlock all hub doors
const unlockAllHubDoors = async () => {
  if (!originalArchive.value?.path) {
    notify.error(t("editArchive.noArchiveLoaded"));
    return;
  }

  try {
    await invoke("unlock_all_hub_doors", { filePath: originalArchive.value.path });
    notify.success(t("editArchive.hubDoorsUnlocked"));
  } catch (error) {
    console.error("Unlock hub doors failed:", error);
    notify.error(String(error));
  }
};

onUnmounted(() => {
  if (props.archiveData) {
    editArchiveDataStore.delete("current");
  }
  if (messageTimeout) clearTimeout(messageTimeout);
});

onMounted(() => {
  initArchiveData();
  nextTick(() => initHighlight());
});
</script>

<style scoped>
.edit-archive-container {
  height: calc(100vh - 38px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Top title */
.page-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-primary,
.btn-secondary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-button);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: white;
  position: relative;
  overflow: hidden;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--hover-bg);
  border-color: color-mix(in srgb, var(--primary) 20%, transparent);
}

/* Save button loading spinner */
.save-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-circle);
  border-top-color: white;
  animation: save-spin 0.8s linear infinite;
  margin-right: 2px;
}

@keyframes save-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Tab navigation - floating style */
.tab-nav {
  /* Absolutely centered on the HEADER itself — flex space-between would
     center it only within the leftover space between title and actions. */
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 4px;
  padding: 6px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.tab-highlight {
  position: absolute;
  top: 6px;
  left: 6px;
  height: calc(100% - 12px);
  background: var(--primary);
  border-radius: var(--radius-xs);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--primary) 30%, transparent);
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 0;
}

.tab-btn {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: white;
}

/* Content area */
.tab-content {
  flex: 1;
  overflow: hidden;
  padding: 0;
  min-height: 0;
  box-sizing: border-box;
  position: relative;
}

.tab-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24px;
  overflow-y: auto;
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.slide-right .tab-panel {
  transform: translateX(24px);
}

.slide-left .tab-panel {
  transform: translateX(-24px);
}

.tab-panel.tab-active {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

/* Error state */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  padding: 40px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  color: var(--text-tertiary);
  opacity: 0.6;
}

.error-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.error-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  max-width: 400px;
  line-height: 1.5;
}

/* Responsive */
@media (max-width: 900px) {
  .page-header {
    flex-wrap: wrap;
    gap: 12px;
  }

  .tab-nav {
    /* Back into the wrapped flow on narrow screens */
    position: static;
    left: auto;
    top: auto;
    transform: none;
    order: 3;
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 600px) {
  .page-header {
    padding: 12px 16px;
  }

  .page-title {
    font-size: 16px;
  }

  .tab-nav {
    overflow-x: auto;
  }

  .tab-btn {
    padding: 6px 12px;
    font-size: 12px;
    white-space: nowrap;
  }

  .tab-content {
    padding: 16px;
  }

  .btn-primary span,
  .btn-secondary span {
    display: none;
  }

  .btn-primary,
  .btn-secondary {
    padding: 8px 12px;
  }
}
</style>
