<template>
  <div class="create-archive-container" :class="{ 'sidebar-expanded': isSidebarExpanded }">
    <!-- Step indicator -->
    <div class="step-indicator">
      <!-- Left button area -->
      <div class="step-indicator-left">
        <!-- Back to quick mode button - only shown in quick mode and only on step 1 -->
        <button v-if="isQuickMode && currentStep === 1" class="back-to-quick-mode-btn" @click="goBackToQuickMode">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
          <span>{{ $t("createArchive.backToQuickMode") }}</span>
        </button>
        <!-- Select creation mode button - only shown in non-quick mode and only on step 1 -->
        <button v-else-if="currentStep === 1" class="mode-select-button" @click="goToSelectMode">
          <font-awesome-icon :icon="['fas', 'th-large']" />
          <span>{{ $t("createMode.title") }}</span>
        </button>
      </div>

      <div class="step" :class="{ active: currentStep >= 1, completed: currentStep > 1 }">
        <span class="step-number">{{ $t("common.step", { number: 1 }) }}</span>
        <span class="step-label">{{ $t("createArchive.steps.selectLevel") }}</span>
      </div>
      <div class="step-connector"></div>
      <div class="step" :class="{ active: currentStep >= 2, completed: currentStep > 2 }">
        <span class="step-number">{{ $t("common.step", { number: 2 }) }}</span>
        <span class="step-label">{{ $t("createArchive.steps.configureArchive") }}</span>
      </div>
      <div class="step-connector"></div>
      <div class="step" :class="{ active: currentStep >= 3, completed: currentStep > 3 }">
        <span class="step-number">{{ $t("common.step", { number: 3 }) }}</span>
        <span class="step-label">{{ $t("createArchive.steps.editInventory") }}</span>
      </div>

      <!-- Right spacer to keep centered -->
      <div class="step-indicator-right"></div>
    </div>

    <!-- Main content area -->
    <div ref="contentWrapperRef" class="content-wrapper" :class="{ 'no-ending-selector': currentStep !== 1 }">
      <transition name="step-transition" mode="out-in" @enter="onStepEnter" @leave="onStepLeave">
        <div :key="currentStep" class="step-container">
          <!-- Step 1: Select level -->
          <Step1SelectLevel
            v-if="currentStep === 1"
            :selected-level="selectedLevel"
            :selected-ending="selectedEnding"
            :available-levels="availableLevels"
            :endings="endings"
            @select-level="onStep1SelectLevel"
            @select-ending="selectEnding"
          />

          <!-- Step 2: Configure archive -->
          <Step2ConfigArchive
            v-else-if="currentStep === 2"
            v-model:archive-name="archiveName"
            :selected-difficulty="selectedDifficulty"
            :selected-actual-difficulty="selectedActualDifficulty"
            :difficulty-levels="difficultyLevels"
            @select-difficulty="selectDifficulty"
            @select-actual-difficulty="selectActualDifficulty"
          />

          <!-- Step 3: Edit inventory -->
          <Step3EditInventory
            v-else-if="currentStep === 3"
            v-model:new-steam-id="newSteamId"
            :players="players"
            :active-player-index="activePlayerIndex"
            :player-input-message="playerInputMessage"
            :player-input-message-type="playerInputMessageType"
            @add-steam-id="addSteamId"
            @remove-player="removePlayer"
            @select-player="selectPlayer"
            @edit-slot="editSlot"
            @update-player-sanity="updatePlayerSanity"
          />
        </div>
      </transition>
    </div>

    <!-- Bottom action buttons -->
    <div class="bottom-actions">
      <button class="action-button secondary" :disabled="currentStep === 1" @click="previousStep">
        <font-awesome-icon :icon="['fas', 'arrow-left']" />
        {{ $t("createArchive.previous") }}
      </button>

      <div class="step-info">
        {{ $t("createArchive.step") }}
        <transition name="step-info-change" mode="out-in">
          <span :key="currentStep">{{ currentStep }}</span>
        </transition>
        / 3
      </div>

      <button class="action-button primary" :disabled="!canProceed" @click="nextStep">
        <template v-if="currentStep === 3 && isCreating">
          {{ $t("createArchive.creating") }}
          <font-awesome-icon :icon="['fas', 'spinner']" spin />
        </template>
        <template v-else-if="currentStep === 3 && isQuickMode">
          {{ $t("createArchive.finish") }}
          <font-awesome-icon :icon="['fas', 'check']" />
        </template>
        <template v-else>
          {{ currentStep === 3 ? $t("createArchive.createArchive") : $t("createArchive.next") }}
          <font-awesome-icon :icon="['fas', currentStep === 3 ? 'check' : 'arrow-right']" />
        </template>
      </button>
    </div>

    <!-- Item selector -->
    <InventoryItemSelector
      :visible="showItemSelector"
      :selected-item="selectedItem"
      @select="handleItemSelect"
      @update:visible="showItemSelector = $event"
    />

    <!-- Creation success modal -->
    <BaseModal
      :visible="showSuccessModal"
      max-width="520px"
      overlay-class="success-modal-overlay"
      card-class="success-modal-card"
      @close="closeSuccessModal"
    >
      <div class="success-modal-icon-circle">
        <svg class="success-modal-check-mark" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M20 6L9 17L4 12"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <h2 class="success-modal-title">{{ $t("createArchive.archiveCreated") }}</h2>
      <p class="success-modal-subtitle">{{ $t("createArchive.archiveCreatedMessage") }}</p>
      <!-- Post-creation action options -->
      <div class="success-modal-actions">
        <button class="success-action-btn primary" @click="handleEditCreatedArchive">
          <font-awesome-icon :icon="['fas', 'pen']" />
          {{ $t("createArchive.editArchive") }}
        </button>
        <button class="success-action-btn secondary" @click="handleCreateAnother">
          <font-awesome-icon :icon="['fas', 'plus']" />
          {{ $t("createArchive.createAnother") }}
        </button>
        <button class="success-action-btn secondary" @click="handleGoHome">
          <font-awesome-icon :icon="['fas', 'home']" />
          {{ $t("createArchive.goHome") }}
        </button>
      </div>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, onActivated, nextTick, watch } from "vue";
import { gsap } from "gsap";
import { isReducedMotion } from "@/utils/performance";
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";
import InventoryItemSelector from "@/components/feature/InventoryItemSelector.vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import { notify } from "@/services/notificationService";
import { tauriArchiveAdapter } from "@/adapters/tauri/archiveAdapter";
import { tauriPlayerAdapter } from "@/adapters/tauri/playerAdapter";
import Step1SelectLevel from "./Step1SelectLevel.vue";
import Step2ConfigArchive from "./Step2ConfigArchive.vue";
import Step3EditInventory from "./Step3EditInventory.vue";
import { ENDING_LEVELS, ENDINGS_CONFIG } from "@/data/endingsData";
import { FEATURES } from "@/config/features";
import { getItemIdByName } from "@/utils/itemIdMap";
import { getLevelImage } from "@/utils/levelUtils";

// Explicit name so the router-view keep-alive include list can match it.
defineOptions({ name: "CreateArchive" });

const { t, te } = useI18n({ useScope: "global" });
const router = useRouter();
const route = useRoute();

const getLevelName = (levelKey) => {
  const translationKey = `LevelName_Display.${levelKey}`;
  return te(translationKey) ? t(translationKey) : levelKey;
};

// Check if entering from quick mode
const isQuickMode = computed(() => route.query.quickMode === "true");
const currentStep = ref(1);
const previousStepValue = ref(1);
const selectedLevel = ref(-1);
// Special-tab picks (e.g. LevelCheat) live outside every route list
const specialLevelKey = ref(null);

const getSelectedLevelData = () => {
  if (specialLevelKey.value) return { levelKey: specialLevelKey.value };
  return availableLevels[selectedLevel.value];
};
const selectedEnding = ref(0);
const archiveName = ref("");
const selectedDifficulty = ref("normal");
const selectedActualDifficulty = ref("normal");
const newSteamId = ref("");
const activePlayerIndex = ref(-1);
const showItemSelector = ref(false);
const showSuccessModal = ref(false);
const contentWrapperRef = ref(null);
const editingSlot = ref({ playerIndex: -1, slotIndex: -1 });
const selectedItem = computed(() => {
  const { playerIndex, slotIndex } = editingSlot.value;
  const item = players[playerIndex]?.inventory?.[slotIndex];
  if (!item || item === "None") return null;
  return item;
});
const isCreating = ref(false);
const playerInputMessage = ref("");
const playerInputMessageType = ref("");
const availableLevels = reactive([]);
const players = reactive([]);
let successModalTimer = null;

const createdArchiveName = ref("");

// Ending data - store levels data
const endingLevelsData = reactive({
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
});

// Ending data - use computed for language reactivity
const endings = computed(() =>
  ENDINGS_CONFIG.map((cfg) => ({
    id: cfg.id,
    label: t(`createArchive.endings.${cfg.labelKey}`),
    levels: endingLevelsData[cfg.id],
  })),
);

const difficultyLevels = [
  { value: "easy", label: "easy", icon: ["fas", "smile"] },
  { value: "normal", label: "normal", icon: ["fas", "meh"] },
  { value: "hard", label: "hard", icon: ["fas", "frown"] },
  { value: "nightmare", label: "nightmare", icon: ["fas", "skull"] },
];

const canProceed = computed(() => {
  if (isCreating.value) return false;
  switch (currentStep.value) {
    case 1:
      return selectedLevel.value !== -1 || !!specialLevelKey.value;
    case 2:
      return archiveName.value.trim() !== "" && !archiveName.value.includes("_");
    case 3:
      return true;
    default:
      return true;
  }
});

watch(selectedEnding, () => {});

const selectDifficulty = (difficulty) => {
  selectedDifficulty.value = difficulty;
  if (FEATURES.MERGE_DIFFICULTY) {
    selectedActualDifficulty.value = difficulty;
  }
};
const selectActualDifficulty = (difficulty) => {
  selectedActualDifficulty.value = difficulty;
};

const selectEnding = async (index) => {
  if (selectedEnding.value === index) return;
  selectedEnding.value = index;
  selectedLevel.value = -1;
  await nextTick();
  loadLevelsForEnding(index);
  await nextTick();
};

const goToSelectMode = () => {
  router.push("/select-create-mode");
};

const goBackToQuickMode = () => {
  // Clear state data from sessionStorage
  sessionStorage.removeItem("quickModeArchiveConfig");
  sessionStorage.removeItem("quickModeCurrentState");
  router.push("/quick-create-archive");
};

const loadLevels = async () => {
  endingLevelsData[0] = ENDING_LEVELS[0];
  endingLevelsData[1] = ENDING_LEVELS[1];
  endingLevelsData[2] = ENDING_LEVELS[2];
  endingLevelsData[3] = ENDING_LEVELS[3];
  loadLevelsForEnding(0);
};

const loadLevelsForEnding = async (endingIndex) => {
  const endingLevels = endings.value[endingIndex].levels;
  const newLevels = endingLevels.map((levelKey) => ({
    name: getLevelName(levelKey),
    image: getLevelImage(levelKey),
    levelKey: levelKey,
  }));
  availableLevels.splice(0, availableLevels.length, ...newLevels);
};

const selectLevel = (index) => {
  selectedLevel.value = index;
  // Animation moved to Step1SelectLevel component
};

// Step1 emits the picked CARD (levelKey-bearing). Resolve its index in the
// active list; when a cross-ending search result was chosen, switch to that
// ending first so parent state (selectedEnding/availableLevels) stays coherent.
const onStep1SelectLevel = async (card) => {
  if (!card || !card.levelKey) return;
  let idx = availableLevels.findIndex((l) => l.levelKey === card.levelKey);
  if (idx === -1) {
    const target = ENDINGS_CONFIG.findIndex((cfg) =>
      (ENDING_LEVELS[cfg.id] || []).includes(card.levelKey),
    );
    if (target !== -1 && target !== selectedEnding.value) {
      await selectEnding(target);
      idx = availableLevels.findIndex((l) => l.levelKey === card.levelKey);
    }
  }
  if (idx !== -1) {
    specialLevelKey.value = null;
    selectLevel(idx);
  } else {
    // Special bucket pick (e.g. LevelCheat): kept outside the route lists
    specialLevelKey.value = card.levelKey;
    selectedLevel.value = -1;
  }
};

const validateSteamId = (steamId) => {
  if (!steamId || steamId.trim() === "") {
    return { valid: false, message: t("createArchive.steamIdRequired") };
  }
  if (steamId.includes("-")) {
    const parts = steamId.split("-");
    if (parts.length === 2 && parts[0].length === 5 && parts[1].length === 15) {
      return {
        valid: true,
        isOfflinePlayer: true,
        processedSteamId: parts[0],
      };
    }
    return { valid: false, message: t("createArchive.steamIdInvalid") };
  }
  if (!/^\d+$/.test(steamId)) {
    return { valid: false, message: t("createArchive.steamIdInvalid") };
  }
  if (steamId.length !== 17) {
    return {
      valid: false,
      message: t("createArchive.steamIdValidationError", {
        error: t("createArchive.steamIdLengthError"),
      }),
    };
  }
  return { valid: true, isOfflinePlayer: false, processedSteamId: steamId };
};

const showPlayerMessage = (message, type = "success") => {
  playerInputMessage.value = message;
  playerInputMessageType.value = type;
  setTimeout(() => {
    playerInputMessage.value = "";
    playerInputMessageType.value = "";
  }, 3000);
};

const addSteamId = async () => {
  const steamId = newSteamId.value.trim();
  if (!steamId) return;
  const validation = validateSteamId(steamId);
  if (!validation.valid) {
    showPlayerMessage(validation.message, "error");
    return;
  }
  const isDuplicate = players.some((player) => player.steamId === validation.processedSteamId);
  if (isDuplicate) {
    showPlayerMessage(
      t("createArchive.steamIdDuplicate", {
        steamId: validation.processedSteamId,
      }),
      "error",
    );
    return;
  }
  // 在线玩家必须有可复用的 EOS 账号标识：游戏只认 `<steam id>_+_|<EOS id>` 键，
  // 纯 steam id 的新玩家游戏不会识别，只会新建一条空的 PlayerData，分配的数据不生效
  if (!validation.isOfflinePlayer) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await invoke("get_player_unique_ids", {
        steamIds: [validation.processedSteamId],
      });
      const foundKey = res?.map?.[validation.processedSteamId];
      if (!foundKey || !foundKey.includes("_+_|")) {
        showPlayerMessage(
          t("createArchive.playerMissingEosKey", {
            steamId: validation.processedSteamId,
          }),
          "error",
        );
        return;
      }
    } catch {
      // 查询失败时不阻止，退回原逻辑
    }
  }
  const newPlayer = {
    steamId: validation.processedSteamId,
    inventory: Array(12).fill(null),
    username: validation.isOfflinePlayer ? `${validation.processedSteamId}${t("common.localPlayerSuffix")}` : null,
    isOfflinePlayer: validation.isOfflinePlayer,
    sanity: 100,
  };
  players.push(newPlayer);
  newSteamId.value = "";
  if (activePlayerIndex.value === -1) activePlayerIndex.value = 0;
  showPlayerMessage(t("createArchive.playerAddedSuccess"), "success");
  if (!validation.isOfflinePlayer) await fetchSteamUsernames();
};

const removePlayer = (index) => {
  players.splice(index, 1);
  if (activePlayerIndex.value >= players.length) activePlayerIndex.value = players.length - 1;
};

const selectPlayer = (index) => {
  activePlayerIndex.value = index;
};

const updatePlayerSanity = ({ playerIndex, sanity }) => {
  if (playerIndex < 0 || playerIndex >= players.length) return;
  const val = Number(sanity);
  players[playerIndex].sanity = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 100;
};

const editSlot = (playerIndex, slotIndex) => {
  if (playerIndex >= 0 && playerIndex < players.length) {
    editingSlot.value = { playerIndex, slotIndex };
    showItemSelector.value = true;
  }
};

const handleItemSelect = (itemId) => {
  if (editingSlot.value.playerIndex >= 0 && editingSlot.value.slotIndex >= 0) {
    const { playerIndex, slotIndex } = editingSlot.value;
    if (players[playerIndex] && players[playerIndex].inventory) {
      players[playerIndex].inventory[slotIndex] = itemId;
    }
  }
  editingSlot.value = { playerIndex: -1, slotIndex: -1 };
  showItemSelector.value = false;
};

const resetForm = () => {
  currentStep.value = 1;
  selectedLevel.value = -1;
  specialLevelKey.value = null;
  selectedEnding.value = 0;
  archiveName.value = "";
  selectedDifficulty.value = "normal";
  selectedActualDifficulty.value = "normal";
  newSteamId.value = "";
  activePlayerIndex.value = -1;
  players.splice(0, players.length);
  isCreating.value = false;
  loadLevelsForEnding(0);
};

// Step transition direction: 1 = forward (slide left), -1 = backward (slide right)
const stepDirection = ref(1);

const nextStep = () => {
  if (currentStep.value < 3 && canProceed.value) {
    stepDirection.value = 1; // Forward direction
    previousStepValue.value = currentStep.value;
    currentStep.value++;
  } else if (currentStep.value === 3) {
    // If in quick mode, pass config data back to quick mode page
    if (isQuickMode.value) {
      finishAndReturnToQuickMode();
    } else {
      createArchive();
    }
  }
};

/**
 * Complete config and return to quick mode
 * Pass current archive config data back to quick mode page
 */
const finishAndReturnToQuickMode = () => {
  const selectedLevelData = getSelectedLevelData();

  // Build archive config data
  const archiveConfig = {
    name: archiveName.value.trim() || "Unnamed Archive",
    level: selectedLevelData?.levelKey || null,
    difficulty: selectedDifficulty.value,
    actualDifficulty: FEATURES.MERGE_DIFFICULTY ? selectedDifficulty.value : selectedActualDifficulty.value,
    players: players.map((p) => ({
      steamId: p.steamId,
      inventory: [...p.inventory],
      username: p.username,
      isOfflinePlayer: p.isOfflinePlayer,
    })),
    ending: selectedEnding.value,
  };

  // Store config data in sessionStorage for quick mode page to read
  sessionStorage.setItem("quickModeArchiveConfig", JSON.stringify(archiveConfig));

  // Navigate back to quick mode page
  router.push("/quick-create-archive");
};

const previousStep = () => {
  if (currentStep.value > 1) {
    stepDirection.value = -1; // Backward direction
    previousStepValue.value = currentStep.value;
    currentStep.value--;
  }
};

// Steam usernames are not resolvable by this app (no backend Steam Web API
// integration), so we don't invoke any command here. Online players simply
// keep a null username and the UI falls back to showing the steam id. This
// also avoids the "get_steam_usernames_command not found" invoke rejection.
const fetchSteamUsernames = async () => {
  return;
};

const loadJsonFile = async (filename) => {
  try {
    const response = await fetch(`/${filename}`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Failed to read ${filename}:`, error);
    return null;
  }
};

const createArchive = async () => {
  if (isCreating.value) return;
  try {
    isCreating.value = true;
    const selectedLevelData = getSelectedLevelData();
    if (!selectedLevelData) {
      notify.error(t("createArchive.selectLevelRequired"));
      isCreating.value = false;
      return;
    }
    const basicArchive = await loadJsonFile("BasicArchive.json");
    if (!basicArchive) {
      notify.error(t("createArchive.loadTemplateFailed"));
      isCreating.value = false;
      return;
    }
    // Progression parity with the editor: SIDE = not on the main route's
    // full table; side levels hard-unlock MEG and the main ending.
    const megLevels = ["Level0", "TopFloor", "MiddleFloor", "GarageLevel2", "BottomFloor", "TheHub"];
    const isSideLevel = !ENDING_LEVELS[0].includes(selectedLevelData.levelKey);
    const isMEGUnlocked = !megLevels.includes(selectedLevelData.levelKey) || isSideLevel;
    const savedName = archiveName.value.trim() || "Unnamed Archive";
    createdArchiveName.value = savedName;
    // 从已有存档查找完整 PlayerData 键（`<steam id>_+_|<EOS 账号 id>`）：
    // EOS 后缀由 Epic 服务器按账号生成，应用无法推导，只能复用存档里已有的键
    let uniqueIdMap = {};
    const playerSteamIds = players.map((p) => p.steamId || "").filter(Boolean);
    if (playerSteamIds.length > 0) {
      try {
        const idResult = await tauriPlayerAdapter.getPlayerUniqueIds(playerSteamIds);
        if (idResult.success) {
          uniqueIdMap = idResult.data || {};
        }
      } catch {
        // 查询失败时退回纯 steam id
      }
    }
    // camelCase 领域模型；snake_case 转换统一由 archiveAdapter 完成
    const createOptions = {
      archiveName: savedName,
      level: selectedLevelData.levelKey || "Level0",
      gameMode: "multiplayer",
      difficulty: selectedDifficulty.value.charAt(0).toUpperCase() + selectedDifficulty.value.slice(1) || "Normal",
      actualDifficulty:
        (FEATURES.MERGE_DIFFICULTY ? selectedDifficulty.value : selectedActualDifficulty.value)
          .charAt(0)
          .toUpperCase() +
          (FEATURES.MERGE_DIFFICULTY ? selectedDifficulty.value : selectedActualDifficulty.value).slice(1) || "Normal",
      players: players.map((p) => ({
        // 纯 steam id；若该玩家在已有存档里存在完整键（含 EOS 后缀），复用，保证数据能绑定
        steamId: uniqueIdMap[p.steamId] || p.steamId || "",
        inventory: Array.isArray(p.inventory)
          ? p.inventory.filter((item) => item !== null && item !== undefined).map((item) => getItemIdByName(item))
          : [],
        sanity: typeof p.sanity === "number" ? p.sanity : 100,
      })),
      basicArchive: basicArchive || {},
      mainEnding: isSideLevel,
      megUnlocked: isMEGUnlocked,
    };
    if (!createOptions.archiveName) {
      notify.error(t("createArchive.enterArchiveName"));
      isCreating.value = false;
      return;
    }
    if (!createOptions.level) {
      notify.error(t("createArchive.selectLevelRequired"));
      isCreating.value = false;
      return;
    }
    const result = await tauriArchiveAdapter.createArchive(createOptions);
    if (!result.success) {
      throw new Error(result.error || "Failed to create archive");
    }
    createParticleExplosion();
    openSuccessModal();
  } catch (error) {
    console.error("Failed to create archive:", error);
    // Show more specific error message
    const errorMsg = error.message || error.toString() || "Unknown error";
    notify.error(t("createArchive.createFailed", { error: errorMsg }));
    isCreating.value = false;
  }
};

const createParticleExplosion = () => {
  const colors = ["#00d4aa", "#007aff", "#ff3b30", "#ff9500", "#af52de"];
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 6 + 3;
    const x = window.innerWidth / 2 + (Math.random() - 0.5) * 50;
    const y = window.innerHeight / 2 + (Math.random() - 0.5) * 50;
    particle.style.cssText = `position:fixed;width:${size}px;height:${size}px;background:${color};left:${x}px;top:${y}px;border-radius:var(--radius-circle);pointer-events:none;z-index:999;`;
    document.body.appendChild(particle);
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 100 + 50;
    gsap.to(particle, {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      scale: 0,
      opacity: 0,
      duration: 0.8,
      ease: "power1.out",
      onComplete: () => {
        document.body.removeChild(particle);
      },
    });
  }
};

const clearSuccessModalTimer = () => {
  if (successModalTimer) {
    clearTimeout(successModalTimer);
    successModalTimer = null;
  }
};

const finishCreateFlow = () => {
  clearSuccessModalTimer();
  showSuccessModal.value = false;

  const stepsWrapper = contentWrapperRef.value;
  if (!stepsWrapper) {
    resetForm();
    isCreating.value = false;
    return;
  }

  if (isReducedMotion()) {
    resetForm();
    gsap.set(stepsWrapper, { x: "0%", opacity: 1 });
    isCreating.value = false;
    return;
  }

  gsap.killTweensOf(stepsWrapper);
  gsap.to(stepsWrapper, {
    x: "150%",
    opacity: 0,
    duration: 0.25,
    ease: "power1.out",
    onComplete: () => {
      resetForm();
      gsap.set(stepsWrapper, { x: "-150%", opacity: 0 });
      gsap.to(stepsWrapper, {
        x: "0%",
        opacity: 1,
        duration: 0.35,
        ease: "power1.out",
        onComplete: () => {
          isCreating.value = false;
        },
      });
    },
  });
};

const openSuccessModal = () => {
  clearSuccessModalTimer();
  isCreating.value = false;
  showSuccessModal.value = true;
  // No longer auto-close, wait for user action
};

const closeSuccessModal = () => {
  finishCreateFlow();
};

// Post-creation action options
const handleEditCreatedArchive = () => {
  showSuccessModal.value = false;
  router.push({
    name: "EditArchive",
    params: { archiveData: JSON.stringify({ name: createdArchiveName.value }) },
  });
};

const handleCreateAnother = () => {
  showSuccessModal.value = false;
  // Reset form and continue creating
  currentStep.value = 1;
  selectedLevel.value = -1;
  specialLevelKey.value = null;
  selectedEnding.value = 0;
  archiveName.value = "";
  selectedDifficulty.value = "normal";
  selectedActualDifficulty.value = "normal";
  newSteamId.value = "";
  activePlayerIndex.value = -1;
  players.splice(0, players.length);
  loadLevelsForEnding(0);
  nextTick(() => {
    gsap.set(contentWrapperRef.value, { x: "0%", opacity: 1 });
  });
};

const handleGoHome = () => {
  showSuccessModal.value = false;
  router.push("/");
};

const isSidebarExpanded = ref(false);
const handleSidebarExpand = (event) => {
  isSidebarExpanded.value = event.detail;
  updateBottomActionsPosition();
};

const updateBottomActionsPosition = () => {
  const bottomActions = document.querySelector(".bottom-actions");
  if (bottomActions) {
    const sidebarWidth = isSidebarExpanded.value ? 220 : 70;
    bottomActions.style.left = `calc(50% + ${sidebarWidth / 2}px)`;
  }
};

onMounted(async () => {
  resetForm();
  await loadLevels();
  window.addEventListener("sidebar-expand", handleSidebarExpand);
  window.addEventListener("beforeunload", handleBeforeUnload);
  if (players.length > 0) await fetchSteamUsernames();
  updateBottomActionsPosition();
});

onActivated(() => {
  resetForm();
});

const handleBeforeUnload = (e) => {
  // If there is form data, creation in progress, or success modal shown, warn user
  if (
    archiveName.value ||
    selectedLevel.value !== -1 ||
    specialLevelKey.value ||
    players.length > 0 ||
    isCreating.value ||
    showSuccessModal.value
  ) {
    e.preventDefault();
    e.returnValue = "";
  }
};

onUnmounted(() => {
  window.removeEventListener("sidebar-expand", handleSidebarExpand);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  clearSuccessModalTimer();
});

const onStepEnter = (el, done) => {
  if (isReducedMotion()) {
    gsap.set(el, { opacity: 1, clearProps: "transform" });
    done();
    return;
  }
  // Enter from right when forward, from left when backward
  const fromX = stepDirection.value === 1 ? 30 : -30;
  gsap.fromTo(
    el,
    { opacity: 0, xPercent: fromX * 0.5 },
    {
      opacity: 1,
      xPercent: 0,
      duration: 0.2,
      ease: "power1.out",
      onComplete: done,
    },
  );
};

const onStepLeave = (el, done) => {
  // Fade out directly without translation to avoid layout issues
  gsap.to(el, {
    opacity: 0,
    duration: 0.15,
    ease: "power1.out",
    onComplete: done,
  });
};
</script>

<style scoped>
.create-archive-container {
  height: calc(100vh - 38px);
  overflow: hidden;
  padding: 10px 24px 0 24px;
  background: var(--bg);
  font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Helvetica Neue", sans-serif;
  display: flex;
  flex-direction: column;
  position: relative;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  gap: 12px;
  position: relative;
}

/* Left and right spacer areas */
.step-indicator-left,
.step-indicator-right {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  min-width: 180px;
}

.step-indicator-left {
  left: 0;
}

.step-indicator-right {
  right: 0;
}

/* Back to quick mode button */
.back-to-quick-mode-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--divider-light);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-to-quick-mode-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-color);
  border-color: var(--accent-color);
  transform: translateX(-2px);
}

.back-to-quick-mode-btn svg {
  font-size: 12px;
}

/* Select creation mode button */
.mode-select-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--divider-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-select-button:hover {
  background: var(--bg-hover);
  color: var(--accent-color);
  border-color: var(--accent-color);
  transform: translateX(-2px);
}

.mode-select-button svg {
  font-size: 12px;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08));
  transition: all 0.3s ease;
}

.step.active {
  background: var(--accent-color);
  color: white;
  transform: scale(1.05);
}

.step.completed {
  background: var(--success-color);
  color: white;
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-circle);
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.step.active .step-number {
  background: rgba(255, 255, 255, 0.3);
}

.step-label {
  font-size: 14px;
  font-weight: 500;
}

.step-connector {
  width: 40px;
  height: 2px;
  background: var(--divider-color);
  border-radius: var(--radius-pill);
}

.content-wrapper {
  width: 100%;
  margin: 0 auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  overflow: hidden;
  height: calc(100vh - 248px);
  padding: 0 20px;
  padding-bottom: 100px;
  /* Space for floating bottom action bar */
  box-sizing: border-box;
  position: relative;
}

.content-wrapper.no-ending-selector {
  height: calc(100vh - 178px);
  padding-bottom: 100px;
  /* Space for floating bottom action bar */
}

.step-container {
  height: 100%;
  width: 100%;
}

.bottom-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 32px;
  background: var(--bg-secondary);
  border: 1px solid var(--divider-light);
  border-radius: var(--radius-xl);
  position: fixed;
  bottom: 16px;
  left: calc(50% + 35px);
  transform: translateX(-50%);
  width: calc(100% - 88px);
  max-width: 1200px;
  filter: drop-shadow(0 8px 32px rgba(0, 0, 0, 0.15));
  backdrop-filter: blur(12px);
  z-index: 100;
  transition: left 0.3s ease;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: var(--radius-button);
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button.primary {
  background: var(--accent-color);
  color: white;
}

.action-button.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-2px);
}

.action-button.secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.action-button.secondary:hover:not(:disabled) {
  background: var(--bg-hover);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.step-info {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.step-info {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  transition: all 0.3s ease;
}

.step-info span {
  font-weight: 600;
  color: var(--accent-color);
}

.step-info-change-enter-active,
.step-info-change-leave-active {
  transition: all 0.2s ease;
}

.step-info-change-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.step-info-change-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Step transition animation controlled by gsap */
.step-transition-enter-active,
.step-transition-leave-active {
  will-change: transform, opacity;
}

/* Creation success modal: BaseModal overlay/card tweaks (teleported, so :global) */
:global(.success-modal-overlay) {
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

:global(.success-modal-card) {
  min-width: 320px;
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border: 1px solid var(--divider-light);
  padding: 32px 28px;
  text-align: center;
}

.success-modal-icon-circle {
  width: 72px;
  height: 72px;
  margin: 0 auto 18px;
  border-radius: var(--radius-circle);
  background: linear-gradient(135deg, var(--success-color), #00d4aa);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 8px 28px rgba(0, 212, 170, 0.35);
}

.success-modal-check-mark {
  width: 30px;
  height: 30px;
}

.success-modal-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.success-modal-subtitle {
  font-size: 15px;
  color: var(--text-secondary);
}

/* Success modal action buttons */
.success-modal-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 24px;
}

.success-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 20px;
  border: none;
  border-radius: var(--radius-button);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.success-action-btn.primary {
  background: var(--accent-color);
  color: white;
  box-shadow: 0 4px 14px rgba(var(--accent-color-rgb), 0.3);
}

.success-action-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(var(--accent-color-rgb), 0.4);
}

.success-action-btn.secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--divider-light);
}

.success-action-btn.secondary:hover {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .step-indicator {
    flex-wrap: wrap;
    gap: 8px;
  }

  .step {
    padding: 8px 12px;
  }

  .step-label {
    font-size: 12px;
  }

  .step-connector {
    width: 20px;
  }

  .bottom-actions {
    flex-direction: column;
    gap: 12px;
    width: calc(100% - 32px);
    left: 50%;
    transform: translateX(-50%);
    bottom: 16px;
    padding: 16px;
  }

  .action-button {
    width: 100%;
    justify-content: center;
  }
}
</style>
