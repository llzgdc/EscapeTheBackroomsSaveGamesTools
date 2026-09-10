<template>
  <div class="settings-section">
    <h3 class="section-title">
      <font-awesome-icon :icon="['fas', 'info-circle']" />
      {{ title }}
    </h3>
    <div class="settings-card">
      <label class="card-label">{{ label }}</label>
      <input
        :value="modelValue"
        type="text"
        class="settings-input"
        :placeholder="placeholder"
        :maxlength="maxlength"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <transition name="error-fade">
        <div v-if="errorText && modelValue.includes('_')" class="error-message">
          <font-awesome-icon :icon="['fas', 'exclamation-triangle']" />
          {{ errorText }}
        </div>
      </transition>
      <!-- Name-conflict resolution: not just an error — offer a one-click fix -->
      <transition name="error-fade">
        <div v-if="conflictText" class="conflict-message" role="alert">
          <span class="conflict-text">
            <font-awesome-icon :icon="['fas', 'triangle-exclamation']" />
            {{ conflictText }}
          </span>
          <button
            v-if="suggestion"
            type="button"
            class="conflict-suggestion-btn"
            :title="$t('common.useSuggestedName')"
            @click="$emit('use-suggestion')"
          >
            <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" />
            {{ suggestion }}
          </button>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: "" },
  label: { type: String, default: "" },
  placeholder: { type: String, default: "" },
  // When set, an underscore in the name shows this error message
  errorText: { type: String, default: "" },
  // Name-conflict state: message shown when set, plus a one-click
  // "switch to suggestion" button when a suggestion is available
  conflictText: { type: String, default: "" },
  suggestion: { type: String, default: "" },
  maxlength: { type: Number, default: 50 },
  modelValue: { type: String, default: "" },
});

defineEmits(["update:modelValue", "use-suggestion"]);
</script>

<style scoped>
/* ── 区域分组 ── */
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 区域标题（带 accent 竖条装饰） */
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  padding-left: 14px;
  position: relative;
  letter-spacing: -0.02em;
}

.section-title::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  background: var(--accent-color);
  border-radius: var(--radius-xs);
}

.section-title svg {
  color: var(--accent-color);
  font-size: 16px;
}

/* ── 设置卡片 ── */
.settings-card {
  background: linear-gradient(145deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border-radius: var(--radius-lg);
  padding: 24px;
  border: 1px solid var(--border-color);
  filter: drop-shadow(var(--filter-card-shadow));
  position: relative;
  transition: all var(--transition-normal) var(--ease-default);
}

/* 顶部微光描边 */
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

/* 卡片标签 */
.card-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 14px;
}

/* ── 输入框 ── */
.settings-input {
  width: 100%;
  padding: 14px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: linear-gradient(145deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
  color: var(--text-primary);
  font-size: 14px;
  box-sizing: border-box;
  outline: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all var(--transition-normal) var(--ease-default);
}

.settings-input:hover {
  border-color: var(--accent-color);
}

.settings-input:focus {
  border-color: var(--accent-color);
  box-shadow:
    inset 0 0 0 3px color-mix(in srgb, var(--accent-color) 15%, transparent),
    inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.settings-input::placeholder {
  color: var(--text-tertiary);
  opacity: 0.7;
}

/* ── 错误消息 ── */
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(255, 59, 48, 0.1);
  border-radius: var(--radius-xs);
  color: var(--error-color);
  font-size: 13px;
}

/* ── 名称冲突提醒（附解决办法）── */
.conflict-message {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--warning-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning-color) 30%, transparent);
  border-radius: var(--radius-xs);
  color: var(--text-primary);
  font-size: 13px;
}

.conflict-text {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--warning-color);
  font-weight: 500;
}

.conflict-suggestion-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 40%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  color: var(--accent-color);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-normal) var(--ease-default);
}

.conflict-suggestion-btn:hover {
  background: var(--accent-color);
  color: white;
  transform: translateY(-1px);
}

.error-fade-enter-active,
.error-fade-leave-active {
  transition: all 0.3s ease;
}

.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ── 响应式 ── */
@media (max-width: 480px) {
  .settings-card {
    padding: 20px;
  }
}
</style>
