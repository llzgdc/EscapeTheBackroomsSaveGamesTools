<template>
  <div class="step-content" data-step="1">
    <LevelPicker
      :active-group="activeGroup"
      :groups="pickerGroups"
      :selected-key="selectedKey"
      :search-placeholder="$t('createArchive.levelSearch.placeholder')"
      :empty-text="$t('createArchive.levelSearch.noResults')"
      :badge-text="$t('editArchive.unlockMainBadge')"
      clear-search-on-group-change
      @select="handleSelectCard"
      @update:active-group="handleGroupChange"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import LevelPicker from "@/components/archive/LevelPicker.vue";
import { ENDING_LEVELS } from "@/data/endingsData";
import { getLevelImage } from "@/utils/levelUtils";

const props = defineProps({
  selectedLevel: { type: Number, default: -1 },
  selectedEnding: { type: Number, default: 0 },
  availableLevels: { type: Array, default: () => [] },
  endings: { type: Array, default: () => [] },
});

const emit = defineEmits(["select-level", "select-ending"]);

// --- i18n helpers ---
const { t, te, locale } = useI18n({ useScope: "global" });
const lvlName = (k) => {
  const i18nKey = `LevelName_Display.${k}`;
  return te(i18nKey) ? t(i18nKey) : k;
};
const mainRoute = new Set(ENDING_LEVELS[0] || []);

// Cross-locale name lookup so typing "Ocean Map" finds the level even in zh-CN
const enNames = ref({});
const zhNames = ref({});
import("@/i18n/locales/en-US/LevelName_Display.json").then((m) => (enNames.value = m.default)).catch(() => {});
import("@/i18n/locales/zh-CN/LevelName_Display.json").then((m) => (zhNames.value = m.default)).catch(() => {});
const altName = (k) => (locale.value === "en-US" ? zhNames.value[k] : enNames.value[k]) || "";

// Tab model: the four routes plus a trailing "special" bucket (LevelCheat).
// The special bucket is click-to-pick and excluded from search results.
const CHEAT_KEY = "LevelCheat";
const specialActive = ref(false);
const localPickedKey = ref(null);
const activeGroup = ref(props.selectedEnding || 0);

const pickerGroups = computed(() => {
  const routeGroups = props.endings.map((e, ci) => ({
    id: `ending-${e.id}`,
    label: e.label,
    levels: (ENDING_LEVELS[e.id] || []).map((k) => {
      const name = lvlName(k);
      return {
        name,
        altName: altName(k),
        image: getLevelImage(k),
        levelKey: k,
        routeLabel: e.label || "",
        unlockMain: ci !== 0 && mainRoute.has(k),
        _search: `${name} ${altName(k)} ${k}`.toLowerCase(),
      };
    }),
  }));
  routeGroups.push({
    id: "special",
    label: t("editArchive.levelGroup.special"),
    searchable: false,
    levels: [
      {
        name: lvlName(CHEAT_KEY),
        image: "/images/ETB/LevelCheat.webp",
        levelKey: CHEAT_KEY,
        routeLabel: "",
        unlockMain: false,
        _search: CHEAT_KEY.toLowerCase(),
      },
    ],
  });
  return routeGroups;
});

const selectedKey = computed(() => {
  if (localPickedKey.value) return localPickedKey.value;
  return props.availableLevels[props.selectedLevel]?.levelKey || "";
});

// Parent-driven ending change (e.g. cross-route search pick) resets local state
watch(
  () => props.selectedEnding,
  (index) => {
    specialActive.value = false;
    localPickedKey.value = null;
    activeGroup.value = index;
  },
);

const handleGroupChange = (index) => {
  activeGroup.value = index;
  const group = pickerGroups.value[index];
  if (group?.id === "special") {
    if (specialActive.value) return;
    specialActive.value = true;
    localPickedKey.value = CHEAT_KEY;
    emit("select-level", group.levels[0]); // parent records the special pick
    return;
  }
  specialActive.value = false;
  emit("select-ending", index);
};

const handleSelectCard = (card) => {
  // Emit the CARD (levelKey-bearing): parent resolves the right route/index,
  // switching endings when a cross-route search result is picked.
  localPickedKey.value = card.levelKey;
  emit("select-level", card);
};
</script>
