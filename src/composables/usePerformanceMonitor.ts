import { ref, watch, type Ref, type WatchStopHandle } from "vue";
import { detectDevicePerformance, createPerformanceMonitor } from "@/utils/performance";

import type { PerformanceMonitor } from "@/utils/performance";

let monitorInitialized = false;
let globalPerformanceMonitor: PerformanceMonitor | null = null;
// Promise-based guard prevents race: concurrent callers await the same init
let initPromise: Promise<void> | null = null;

interface PerformanceMonitorReturn {
  showPerformanceSettings: Ref<boolean>;
  performanceMode: Ref<string>;
  animationQuality: Ref<string>;
  hardwareAcceleration: Ref<boolean>;
  virtualizationEnabled: Ref<boolean>;
  initPerformanceMonitor: () => void;
  cleanup: () => void;
}

/**
 * Performance monitor composable
 */
export function usePerformanceMonitor(): PerformanceMonitorReturn {
  const showPerformanceSettings = ref(false);
  const performanceMode = ref("auto");
  const animationQuality = ref("medium");
  const hardwareAcceleration = ref(true);
  const virtualizationEnabled = ref(true);

  let cleanupDisplayWatcher: WatchStopHandle | null = null;

  const applyDisplayEffects = (): void => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.performanceMode = performanceMode.value || "auto";
    root.dataset.animationQuality = animationQuality.value || "medium";
  };

  const startDisplayWatcher = (): void => {
    if (cleanupDisplayWatcher) return;
    const stop = watch([performanceMode, animationQuality], () => applyDisplayEffects(), { immediate: true });
    cleanupDisplayWatcher = stop;
  };

  /**
   * Initialize performance monitor (singleton pattern)
   */
  const initPerformanceMonitor = (): void => {
    if (monitorInitialized) {
      startDisplayWatcher();
      return;
    }
    // If init is already in progress, just schedule the display watcher
    // after it completes — don't create a second PerformanceObserver.
    if (initPromise) {
      initPromise.then(() => startDisplayWatcher());
      return;
    }
    monitorInitialized = true;

    initPromise = (async () => {
      const devicePerf = detectDevicePerformance();
      const longTaskThreshold = devicePerf.isVeryLowEndDevice ? 30 : 50;
      const fpsThreshold = devicePerf.isVeryLowEndDevice ? 20 : 30;
      let longTaskCount = 0;
      let isLowPerfMode = false;

      globalPerformanceMonitor = createPerformanceMonitor({
        longTaskThreshold,
        fpsThreshold,
        onLowPerformance: () => {
          performanceMode.value = "low";
          animationQuality.value = "low";
          console.info("Performance issue detected, switched to low performance mode");
          isLowPerfMode = true;
        },
        onPerformanceRecovery: () => {
          if (performanceMode.value === "low") {
            performanceMode.value = "auto";
            animationQuality.value = "medium";
            console.info("Performance recovered, switched to auto performance mode");
            isLowPerfMode = false;
          }
        },
        onFPSUpdate: (fps: number) => {
          if (fps < fpsThreshold && fps > 0) {
            longTaskCount++;
            if (longTaskCount >= 3 && !isLowPerfMode) {
              console.warn(`Low FPS detected (${fps} FPS), auto-switched to low performance mode`);
              performanceMode.value = "low";
              animationQuality.value = "low";
              isLowPerfMode = true;
              longTaskCount = 0;
            }
          } else {
            if (longTaskCount > 0) {
              longTaskCount = Math.max(0, longTaskCount - 1);
            }
          }
        },
      });

      globalPerformanceMonitor.start();

      if (devicePerf.isLowEndDevice) {
        performanceMode.value = "low";
        animationQuality.value = "low";
      } else if (devicePerf.performanceLevel === "high") {
        performanceMode.value = "auto";
        animationQuality.value = "high";
      }
      if (devicePerf.prefersReducedMotion) {
        animationQuality.value = "disabled";
      }
      startDisplayWatcher();
    })().finally(() => {
      initPromise = null;
    });
  };

  /**
   * Clean up resources
   */
  const cleanup = (): void => {
    if (globalPerformanceMonitor) {
      globalPerformanceMonitor.stop();
      globalPerformanceMonitor = null;
    }

    if (cleanupDisplayWatcher) {
      cleanupDisplayWatcher();
      cleanupDisplayWatcher = null;
    }
    monitorInitialized = false;
  };

  return {
    showPerformanceSettings,
    performanceMode,
    animationQuality,
    hardwareAcceleration,
    virtualizationEnabled,
    initPerformanceMonitor,
    cleanup,
  };
}
