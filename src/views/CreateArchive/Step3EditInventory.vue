<template>
  <div class="step-content" data-step="3">
    <div class="players-layout">
      <PlayerManager
        :players="players"
        :active-player-index="activePlayerIndex"
        :new-steam-id="newSteamId"
        :player-input-message="playerInputMessage"
        :player-input-message-type="playerInputMessageType"
        title-key="createArchive.playerManagement"
        empty-hint-key="createArchive.noPlayersHint"
        steam-id-placeholder-key="createArchive.steamIdPlaceholder"
        :show-sanity="true"
        @update:new-steam-id="$emit('update:newSteamId', $event)"
        @add-steam-id="$emit('add-steam-id')"
        @remove-player="$emit('remove-player', $event)"
        @select-player="$emit('select-player', $event)"
      />

      <div v-if="activePlayerIndex !== -1 && players[activePlayerIndex]" class="player-detail-section">
        <div class="detail-header">
          <Transition name="player-name-switch" mode="out-in">
            <span :key="activePlayerIndex">
              {{
                players[activePlayerIndex].username ||
                (players[activePlayerIndex].isOfflinePlayer
                  ? `${players[activePlayerIndex].steamId}(Local)`
                  : players[activePlayerIndex].steamId)
              }}
            </span>
          </Transition>
        </div>

        <Transition name="player-detail-grid-switch" mode="out-in">
          <PlayerDetailPanel
            :key="activePlayerIndex"
            :player="players[activePlayerIndex]"
            slot-label-prefix="createArchive"
            @edit-slot="(slotIndex) => $emit('edit-slot', activePlayerIndex, slotIndex)"
            @sanity-change="(sanity) => $emit('update-player-sanity', { playerIndex: activePlayerIndex, sanity })"
          />
        </Transition>
      </div>

      <div v-else class="player-detail-section empty-detail">
        <font-awesome-icon :icon="['fas', 'hand-pointer']" />
        <p>
          {{ players.length > 0 ? $t("editArchive.selectPlayerHint") : $t("editArchive.addPlayerFirst") }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import PlayerManager from "@/components/system/PlayerManager.vue";
import PlayerDetailPanel from "@/components/player/PlayerDetailPanel.vue";

defineProps({
  newSteamId: { type: String, default: "" },
  players: { type: Array, default: () => [] },
  activePlayerIndex: { type: Number, default: -1 },
  playerInputMessage: { type: String, default: "" },
  playerInputMessageType: { type: String, default: "" },
});

defineEmits([
  "update:newSteamId",
  "add-steam-id",
  "remove-player",
  "select-player",
  "edit-slot",
  "update-player-sanity",
]);
</script>

<style scoped>
/* Backpack editing area */
.step-content {
  height: 100%;
  min-height: 0;
}

.players-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 24px;
  padding: 4px;
  min-height: 0;
  height: 100%;
  align-items: stretch;
}

:deep(.player-list-section) {
  height: 100%;
  min-height: 0;
}

.player-detail-section {
  background: linear-gradient(145deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border-radius: var(--radius-card);
  padding: 24px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.08)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.05));
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  transition: all 0.3s ease;
  min-height: 0;
  overflow-y: auto;
}

.player-name-switch-enter-active,
.player-name-switch-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.player-name-switch-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.player-name-switch-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.player-detail-grid-switch-enter-active,
.player-detail-grid-switch-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.player-detail-grid-switch-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.player-detail-grid-switch-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.player-detail-section::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  pointer-events: none;
}

.player-detail-section:hover {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  filter: drop-shadow(0 8px 30px rgba(0, 0, 0, 0.1)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.06));
}

.player-detail-section.empty-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-tertiary);
  text-align: center;
  gap: 12px;
}

.player-detail-section.empty-detail svg {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.4;
}

.player-detail-section.empty-detail p {
  font-size: 13px;
  margin: 0;
}

.form-section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 18px 0;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-section-title::before {
  content: "";
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, var(--accent-color), rgba(var(--accent-color-rgb), 0.5));
  border-radius: var(--radius-xs);
}

.detail-header {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

@media (max-width: 768px) {
  .players-layout {
    grid-template-columns: 1fr;
  }
}
</style>
