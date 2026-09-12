<template>
  <div class="level-selector">
    <LevelPicker
      v-model:active-group="selectedLevelGroup"
      :groups="levelGroups"
      :selected-key="currentLevel"
      :search-placeholder="$t('editArchive.levelSearchPlaceholder')"
      :empty-text="$t('editArchive.levelSearchEmpty')"
      :badge-text="$t('editArchive.unlockMainBadge')"
      @select="(card) => $emit('update:currentLevel', card.levelKey)"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import LevelPicker from "@/components/archive/LevelPicker.vue";
import { getLevelImage } from "@/utils/levelUtils";
import { ENDING_LEVELS, ENDINGS_CONFIG } from "@/data/endingsData";

defineProps({
  currentLevel: { type: String, default: "Level0" },
});

defineEmits(["update:currentLevel"]);

const { t, te, locale } = useI18n({ useScope: "global" });

const getLevelName = (levelKey) => {
  const translationKey = `LevelName_Display.${levelKey}`;
  return te(translationKey) ? t(translationKey) : levelKey;
};

// Cross-locale name lookup so typing "Ocean Map" finds the level even in zh-CN
const enNames = ref({});
const zhNames = ref({});
import("@/i18n/locales/en-US/LevelName_Display.json").then((m) => (enNames.value = m.default)).catch(() => {});
import("@/i18n/locales/zh-CN/LevelName_Display.json").then((m) => (zhNames.value = m.default)).catch(() => {});
const altName = (k) => (locale.value === "en-US" ? zhNames.value[k] : enNames.value[k]) || "";

const availableLevels = ref([]);

// Capsule selector state; tab/search/grid rendering lives in <LevelPicker>
const selectedLevelGroup = ref(0);

const loadLevels = () => {
  // Get all unique levels from ENDING_LEVELS (0, 1, 2, 3) preserving order
  const seen = new Set();
  const allLevels = [];
  for (const key of [0, 1, 2, 3]) {
    for (const level of ENDING_LEVELS[key] || []) {
      if (!seen.has(level)) {
        seen.add(level);
        allLevels.push(level);
      }
    }
  }
  // Add special levels not in any ending
  const specialLevels = ["LevelCheat"];
  for (const level of specialLevels) {
    if (!seen.has(level)) {
      allLevels.push(level);
    }
  }

  availableLevels.value = allLevels.map((levelKey) => ({
    name: getLevelName(levelKey),
    image: getLevelImage(levelKey),
    levelKey,
  }));
};

// Group levels by ending ROUTE. Each tab lists exactly that route's levels
// from ENDING_LEVELS — nothing else. Levels shared with the main route get an
// extra "_UnlockMain" twin placed right below them in BRANCH tabs only
// (selecting it explicitly requests main-ending unlock semantics); the main
// tab itself stays free of twins so no duplicates ever appear there.
const mkLevel = (levelKey) => {
  const name = getLevelName(levelKey);
  return {
    name,
    altName: altName(levelKey),
    image: getLevelImage(levelKey),
    levelKey,
    _search: `${name} ${altName(levelKey)} ${levelKey}`.toLowerCase(),
  };
};
// Levels shared between a branch route and the main route get an
// informational tag so they are distinguishable during search
const mainRouteSet = new Set(ENDING_LEVELS[0]);

const levelGroups = computed(() => {
  const groups = [];
  ENDINGS_CONFIG.forEach((cfg) => {
    const g = {
      id: cfg.id,
      label: t(`createArchive.endings.${cfg.labelKey}`),
      levels: [],
    };
    (ENDING_LEVELS[cfg.id] || []).forEach((k) => {
      const level = mkLevel(k);
      if (cfg.id !== 0 && mainRouteSet.has(k)) level.unlockMain = true;
      level.routeLabel = g.label; // for cross-group search origin display
      g.levels.push(level);
    });
    groups.push(g);
  });

  // Special bucket: flat-list levels belonging to NO route (e.g. LevelCheat)
  const known = new Set(Object.values(ENDING_LEVELS).flat());
  const leftovers = availableLevels.value.filter((l) => !known.has(l.levelKey));
  if (leftovers.length > 0) {
    groups.push({
      id: "special",
      label: t("editArchive.levelGroup.special"),
      levels: leftovers,
    });
  }
  return groups;
});

onMounted(() => {
  loadLevels();
});
</script>

<style scoped>
.level-selector {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  /* Grid height override for the editor layout (picker default suits the wizard) */
  --level-grid-height: calc(100vh - 200px);
}

@media (max-width: 768px) {
  .level-selector {
    --level-grid-height: calc(100vh - 280px);
  }
}
</style>
