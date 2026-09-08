/**
 * Intelligent Resource Scheduler
 *
 * Automatically detects the current operation context and dynamically
 * allocates hardware resources (CPU, rendering, memory, I/O) to prioritize
 * the active task while reducing resource usage for background operations.
 *
 * Core capabilities:
 * 1. Operation context detection (auto-detect what the user is doing)
 * 2. Dynamic resource profile generation per operation
 * 3. Priority-based background task queue with time-slicing
 * 4. Real-time performance feedback loop (FPS/memory → profile adjustment)
 * 5. Event-driven integration with router, animations, and archive ops
 */

import type {
  OperationContext,
  OperationPriority,
  OperationType,
  ResourceProfile,
  SchedulerState,
  ScheduledTask,
  Prediction,
  PredictionState,
} from "@/types";

// ─── Default Resource Profiles ─────────────────────────────

const DEFAULT_PROFILES: Record<OperationType, ResourceProfile> = {
  "loading-archives": {
    cpuBudget: 0.9,
    animationQuality: "low",
    renderPriority: true,
    gcStrategy: "conservative",
    backgroundTaskThreshold: Infinity,
    throttleInput: false,
    virtualizationLevel: "reduced",
  },
  "batch-creating": {
    cpuBudget: 0.85,
    animationQuality: "low",
    renderPriority: true,
    gcStrategy: "conservative",
    backgroundTaskThreshold: Infinity,
    throttleInput: false,
    virtualizationLevel: "reduced",
  },
  searching: {
    cpuBudget: 0.7,
    animationQuality: "medium",
    renderPriority: true,
    gcStrategy: "normal",
    backgroundTaskThreshold: 2000,
    throttleInput: false,
    virtualizationLevel: "full",
  },
  animating: {
    cpuBudget: 0.6,
    animationQuality: "high",
    renderPriority: false,
    gcStrategy: "normal",
    backgroundTaskThreshold: 1000,
    throttleInput: true,
    virtualizationLevel: "full",
  },
  navigating: {
    cpuBudget: 0.8,
    animationQuality: "medium",
    renderPriority: true,
    gcStrategy: "conservative",
    backgroundTaskThreshold: 3000,
    throttleInput: false,
    virtualizationLevel: "full",
  },
  rendering: {
    cpuBudget: 0.5,
    animationQuality: "medium",
    renderPriority: true,
    gcStrategy: "normal",
    backgroundTaskThreshold: 500,
    throttleInput: true,
    virtualizationLevel: "full",
  },
  editing: {
    cpuBudget: 0.6,
    animationQuality: "medium",
    renderPriority: true,
    gcStrategy: "normal",
    backgroundTaskThreshold: 1000,
    throttleInput: false,
    virtualizationLevel: "full",
  },
  previewing: {
    cpuBudget: 0.4,
    animationQuality: "high",
    renderPriority: false,
    gcStrategy: "normal",
    backgroundTaskThreshold: 500,
    throttleInput: true,
    virtualizationLevel: "full",
  },
  /** Covers everyday UI interactions: scrolling, hovering, typing, clicking.
   *  Not as aggressive as "rendering" but enough to keep 60fps for smooth
   *  scroll + hover effects without starving the GPU compositor. */
  interacting: {
    cpuBudget: 0.45,
    animationQuality: "medium",
    renderPriority: true,
    gcStrategy: "normal",
    backgroundTaskThreshold: 400,
    throttleInput: false,
    virtualizationLevel: "full",
  },
  /** True idle — no user interaction detected for >1s.
   *  Previously set animationQuality: "disabled" which made even subtle
   *  hover → shadow/transform transitions janky because the browser
   *  skipped compositing layer promotion.  Now at "low" so basic
   *  transitions (opacity, transform) still feel smooth, while expensive
   *  paint operations (backdrop-filter, background-color) are skipped. */
  idle: {
    cpuBudget: 0.3,
    animationQuality: "low",
    renderPriority: false,
    gcStrategy: "normal",
    backgroundTaskThreshold: 200,
    throttleInput: true,
    virtualizationLevel: "reduced",
  },
  background: {
    cpuBudget: 0.15,
    animationQuality: "disabled",
    renderPriority: false,
    gcStrategy: "aggressive",
    backgroundTaskThreshold: 50,
    throttleInput: true,
    virtualizationLevel: "minimal",
  },
};

/** Priority ordering for scheduling (higher = more urgent) */
const PRIORITY_ORDER: Record<OperationPriority, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  idle: 1,
};

/** Operation priority mapping */
const OPERATION_PRIORITY: Record<OperationType, OperationPriority> = {
  "loading-archives": "critical",
  "batch-creating": "critical",
  searching: "high",
  animating: "medium",
  navigating: "high",
  rendering: "medium",
  editing: "high",
  previewing: "medium",
  interacting: "low",
  idle: "low",
  background: "idle",
};

/** Operation human-readable labels */
const OPERATION_LABELS: Record<OperationType, string> = {
  "loading-archives": "Loading Archives",
  "batch-creating": "Creating Archives",
  searching: "Searching",
  animating: "Animating",
  navigating: "Navigating",
  rendering: "Rendering",
  editing: "Editing Archive",
  previewing: "Previewing",
  interacting: "Interacting",
  idle: "Idle",
  background: "Background",
};

// ─── Priority Task Queue ───────────────────────────────────

/**
 * Priority-based task queue with time-slicing.
 * Defers background work when the system is busy and
 * runs it in small slices during idle periods.
 */
class PriorityTaskQueue {
  private tasks: ScheduledTask[] = [];
  private running = false;
  private rafId: number | null = null;

  /**
   * Register a background task.
   * Higher-priority tasks run first within the same deferral window.
   */
  add(task: ScheduledTask): void {
    this.tasks.push(task);
    this.tasks.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
  }

  /** Remove a task by ID */
  remove(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
  }

  /** Number of pending tasks */
  get pending(): number {
    return this.tasks.length;
  }

  /**
   * Process tasks in the background during idle time.
   * Each frame, run as much as the resource profile allows.
   */
  tick(profile: ResourceProfile): void {
    if (this.running) return;
    if (this.tasks.length === 0) return;

    this.running = true;

    const budget = profile.cpuBudget;
    const threshold = profile.backgroundTaskThreshold;

    // If threshold is Infinity, don't run any bg tasks
    if (threshold === Infinity) {
      this.running = false;
      return;
    }

    const task = this.tasks[0];
    const timeBudget = Math.max(4, Math.round(task.timeBudget * budget));

    this.rafId = requestAnimationFrame(() => {
      const start = performance.now();

      try {
        const result = task.fn();
        if (result instanceof Promise) {
          // Fire-and-forget for async tasks — the budget is advisory
          result.catch((err) => console.warn(`[Scheduler] Task "${task.label}" failed:`, err));
        }
      } catch (err) {
        console.warn(`[Scheduler] Task "${task.label}" failed:`, err);
      }

      const elapsed = performance.now() - start;

      // If task ran within budget, remove it; otherwise keep it
      if (elapsed < timeBudget * 1.5) {
        this.tasks.shift();
      } else {
        // Task exceeded budget — reduce its timeBudget for next cycle
        this.tasks[0] = { ...task, timeBudget: Math.max(2, task.timeBudget - 4) };
      }

      this.running = false;
    });
  }

  /** Clear all pending tasks */
  clear(): void {
    this.tasks = [];
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.running = false;
  }
}

// ─── Resource Scheduler ────────────────────────────────────

type SchedulerListener = (state: SchedulerState) => void;

/**
 * Intelligent Resource Scheduler singleton.
 *
 * Usage:
 *   import scheduler from "./services/resourceScheduler";
 *   scheduler.beginOperation("loading-archives");
 *   scheduler.endOperation("loading-archives");
 */
class ResourceScheduler {
  private operations = new Map<OperationType, OperationContext>();
  private _currentFps = 60;
  private _currentMemoryMb = 0;
  private _isOverloaded = false;
  private _overloadCount = 0;
  private taskQueue = new PriorityTaskQueue();
  private listeners = new Set<SchedulerListener>();
  private monitorRafId: number | null = null;
  private monitoring = false;
  private _cssVarsApplied = false;
  /** Cache last performance-mode value written to DOM to avoid redundant writes */
  private _lastPerformanceMode: string | null = null;

  // ─── Device Capabilities ────────────────────────────────
  /** Number of logical CPU cores */
  private _cpuCores = 4;
  /** Total system RAM in MB (0 = unknown) */
  private _totalMemoryMb = 0;
  /** Whether the device is low-end (<=4 cores or <=4GB RAM) */
  private _isLowEndDevice = false;

  /** Headroom: maximum safe CPU budget based on available cores.
   *  Always leaves at least 1.5 cores for the OS and other apps. */
  private _cpuHeadroom = 0.7;
  /** Headroom: maximum safe memory use in MB (80% of total RAM). */
  private _memHeadroomMb = 0;

  // ─── Interaction Detection ───────────────────────────────
  private _interactionTimer: ReturnType<typeof setTimeout> | null = null;
  private _interactionThrottle = 0;
  private readonly INTERACTION_IDLE_TIMEOUT = 1200; // ms with no input before returning to idle
  private readonly INTERACTION_EVENTS = [
    "mousemove",
    "scroll",
    "keydown",
    "touchstart",
    "touchmove",
    "wheel",
    "pointerdown",
    "pointermove",
  ] as const;
  private _boundOnInteraction: ((e: Event) => void) | null = null;

  // ─── Prediction State ────────────────────────────────────
  private _prediction: Prediction | null = null;
  private _predictionPhase: PredictionState["phase"] = "idle";
  private _predictionTimer: ReturnType<typeof setTimeout> | null = null;
  /** Operation types currently running as prediction placeholders. A type
   *  stays marked until either a real beginOperation takes it over (unmark,
   *  so cancelPrediction cannot end the real op) or the prediction is cleared
   *  without the real op having started (end the placeholder). */
  private _predictedOperations = new Set<OperationType>();

  // ─── Operation Lifecycle ───────────────────────────────

  /**
   * Begin an operation. Multiple operations can be active simultaneously;
   * the scheduler picks the highest-priority one for resource allocation.
   *
   * If a prediction exists for this operation type, it is automatically
   * cleared — the real operation has started.
   */
  beginOperation(type: OperationType, metadata?: OperationContext["metadata"]): void {
    // A real operation of this type is starting: unmark any prediction
    // placeholder BEFORE clearing the prediction state — clearPrediction()
    // ends still-marked placeholders, and the real op must survive a later
    // cancelPrediction().
    this._predictedOperations.delete(type);

    // Auto-clear prediction when the real operation starts
    if (this._prediction?.type === type) {
      this.clearPrediction();
      this.deprewarm();
    }

    const existing = this.operations.get(type);
    if (existing) {
      // Update metadata if already active
      if (metadata) {
        existing.metadata = metadata;
      }
      return;
    }

    this.operations.set(type, {
      type,
      priority: OPERATION_PRIORITY[type],
      label: OPERATION_LABELS[type],
      startedAt: performance.now(),
      metadata,
    });

    this.applyProfile();
    this.emitState();
  }

  /**
   * Update metadata for an ongoing operation (e.g., progress).
   */
  updateOperation(type: OperationType, metadata: OperationContext["metadata"]): void {
    const op = this.operations.get(type);
    if (op) {
      op.metadata = { ...op.metadata, ...metadata };
      this.emitState();
    }
  }

  /**
   * End an operation. Resources are reallocated to the next active operation.
   */
  endOperation(type: OperationType): void {
    const removed = this.operations.delete(type);
    if (removed) {
      this.applyProfile();
      this.emitState();
    }
  }

  // ─── Predictive Scheduling ─────────────────────────────

  /**
   * Register a prediction about a future operation.
   *
   * When confidence >= 0.7 (default), the scheduler IMMEDIATELY starts
   * allocating resources for the predicted operation — BEFORE it begins:
   *   - CPU budget is raised to the predicted operation's profile
   *   - Background tasks are suspended
   *   - Rendering priority is adjusted
   *   - CSS custom properties are updated so components can prepare
   *
   * The prediction auto-cancels after leadTime * 3 ms if the operation
   * doesn't start.  Calling beginOperation(type) with the same type
   * cancels the prediction automatically.
   *
   * Example:
   *   scheduler.predict("loading-archives", { source: "route-change", leadTime: 300 });
   */
  predict(
    type: OperationType,
    options?: {
      source?: string;
      leadTime?: number;
      confidence?: number;
    },
  ): void {
    const { source = "manual", leadTime = 300, confidence = 0.8 } = options ?? {};

    // Don't predict if the operation is already active
    if (this.operations.has(type)) {
      this.clearPrediction();
      return;
    }

    // Clear any existing prediction
    this.clearPrediction();

    this._prediction = {
      type,
      confidence,
      leadTime,
      createdAt: performance.now(),
      source,
    };

    // Only commit resources if confidence is high enough
    if (confidence >= 0.7) {
      this._predictionPhase = "committed";
      // Register a placeholder operation so resource allocation switches to
      // the predicted profile immediately. This must NOT go through
      // beginOperation() — that treats the call as a real operation taking
      // over, which would unmark the placeholder and leave the auto-cancel
      // below unable to ever end it.
      this._predictedOperations.add(type);
      this.operations.set(type, {
        type,
        priority: OPERATION_PRIORITY[type],
        label: OPERATION_LABELS[type],
        startedAt: performance.now(),
        metadata: { totalItems: 0, completedItems: 0 },
      });
      this.applyProfile();
      this.deprewarm();
    } else {
      this._predictionPhase = "preparing";
    }

    this.emitState();

    // Auto-cancel after leadTime * 2.5 if operation never starts
    this._predictionTimer = setTimeout(
      () => {
        if (this._prediction && this._prediction.type === type) {
          this.cancelPrediction();
        }
      },
      Math.max(leadTime * 2.5, 1000),
    );
  }

  /** Cancel the active prediction and revert resource allocation. */
  cancelPrediction(): void {
    if (!this._prediction) return;
    this.clearPrediction();
    this.deprewarm();
  }

  /** Internal: clear prediction state. Any operations still marked as
   *  predicted are placeholders started by this prediction that a real
   *  beginOperation never took over — end them here, otherwise nothing
   *  ever does and they leak in `operations` for the whole session. */
  private clearPrediction(): void {
    this._prediction = null;
    this._predictionPhase = "idle";
    if (this._predictionTimer !== null) {
      clearTimeout(this._predictionTimer);
      this._predictionTimer = null;
    }
    for (const type of this._predictedOperations) {
      this._predictedOperations.delete(type);
      this.endOperation(type);
    }
  }

  /**
   * Pre-warm resources for a specific operation type.
   * Called automatically by predict() when confidence is high,
   * but can also be called directly.
   */
  prewarm(type: OperationType): void {
    if (typeof document === "undefined") return;
    switch (type) {
      case "loading-archives":
      case "batch-creating": {
        const container = document.querySelector(".archive-list-container");
        if (container instanceof HTMLElement) {
          container.style.willChange = "transform, scroll-position";
        }
        break;
      }
      case "searching": {
        const searchEl = document.querySelector(".search-overlay");
        if (searchEl instanceof HTMLElement) {
          searchEl.style.willChange = "opacity, transform";
        }
        break;
      }
      default:
        break;
    }
  }

  /** Clean up pre-warm will-change hints. */
  private deprewarm(): void {
    if (typeof document === "undefined") return;
    const selectors = ".archive-list-container, .search-overlay, .main-content";
    document.querySelectorAll(selectors).forEach((el) => {
      if (el instanceof HTMLElement) el.style.willChange = "";
    });
  }

  /** Get the current prediction state. */
  get predictionState(): PredictionState {
    return this._prediction
      ? { active: { ...this._prediction }, phase: this._predictionPhase }
      : { active: null, phase: "idle" };
  }

  /** Check if a prediction is active for a specific type. */
  isPredicted(type: OperationType): boolean {
    return this._prediction?.type === type;
  }

  /**
   * Run a synchronous operation under a given context.
   * Automatically begins and ends the operation.
   */
  runOperation<T>(type: OperationType, fn: () => T, metadata?: OperationContext["metadata"]): T {
    this.beginOperation(type, metadata);
    try {
      return fn();
    } finally {
      this.endOperation(type);
    }
  }

  /**
   * Run an async operation under a given context.
   */
  async runAsyncOperation<T>(
    type: OperationType,
    fn: () => Promise<T>,
    metadata?: OperationContext["metadata"],
  ): Promise<T> {
    this.beginOperation(type, metadata);
    try {
      return await fn();
    } finally {
      this.endOperation(type);
    }
  }

  // ─── Resource Profile ──────────────────────────────────

  /** Get the currently active resource profile */
  get currentProfile(): ResourceProfile {
    return this.computeProfile();
  }

  /** Get the current scheduler state snapshot */
  get state(): SchedulerState {
    const dominant = this.getDominantOperation();
    const profile = this.computeProfile();
    const predictionState = this._prediction
      ? { active: this._prediction, phase: this._predictionPhase }
      : { active: null, phase: "idle" as const };

    return {
      currentOperation: dominant?.type ?? "idle",
      currentPriority: dominant?.priority ?? "idle",
      resourceProfile: profile,
      activeOperationsCount: this.operations.size,
      currentFps: this._currentFps,
      currentMemoryMb: this._currentMemoryMb,
      isOverloaded: this._isOverloaded,
      pendingTasks: this.taskQueue.pending,
      prediction: predictionState,
    };
  }

  /** Get the currently dominant (highest-priority) operation */
  get dominantOperation(): OperationType {
    return this.getDominantOperation()?.type ?? "idle";
  }

  /** Get the current dominant priority */
  get dominantPriority(): OperationPriority {
    return this.getDominantOperation()?.priority ?? "idle";
  }

  private getDominantOperation(): OperationContext | null {
    let dominant: OperationContext | null = null;
    let highestPriority = -1;

    for (const op of this.operations.values()) {
      const p = PRIORITY_ORDER[op.priority];
      if (p > highestPriority) {
        highestPriority = p;
        dominant = op;
      }
    }

    return dominant;
  }

  private computeProfile(): ResourceProfile {
    const dominant = this.getDominantOperation();
    if (!dominant) {
      const idle = this.adjustProfile({ ...DEFAULT_PROFILES.idle });
      return this.applyHeadroom(idle);
    }

    let profile = { ...DEFAULT_PROFILES[dominant.type] };

    // Apply FPS-based throttling
    profile = this.adjustProfile(profile);

    // Final safety cap: headroom limits ensure the system stays responsive
    profile = this.applyHeadroom(profile);

    return profile;
  }

  /**
   * Detect device capabilities (CPU cores, total RAM) and calculate
   * safe headroom limits.  Called once during start().
   *
   * CPU headroom: always leave >= 1.5 cores for the OS.
   *   e.g. 4-core → max 62.5%  |  8-core → max 81%  |  16-core → max 90%
   *
   * Memory headroom: never exceed 80% of total physical RAM.
   */
  private detectDeviceCapabilities(): void {
    this._cpuCores = navigator.hardwareConcurrency || 4;
    const nav = navigator as unknown as { deviceMemory?: number };
    this._totalMemoryMb = nav.deviceMemory ? nav.deviceMemory * 1024 : 0;

    this._isLowEndDevice = this._cpuCores <= 4 || (this._totalMemoryMb > 0 && this._totalMemoryMb <= 4096);

    // CPU headroom: leave 1.5 cores free, cap at 0.9, floor at 0.25
    this._cpuHeadroom = Math.max(0.25, Math.min(0.9, 1 - 1.5 / this._cpuCores));

    // Memory headroom: 80% of total RAM, or 2GB if unknown
    this._memHeadroomMb = this._totalMemoryMb > 0 ? this._totalMemoryMb * 0.8 : 2048;
  }

  /**
   * Apply headroom limits to a resource profile.
   * This is the final cap — no operation can exceed these bounds,
   * ensuring the system always has enough resources to stay responsive.
   */
  private applyHeadroom(profile: ResourceProfile): ResourceProfile {
    const capped = { ...profile };

    // ─── CPU cap ─────────────────────────────────────
    // Never exceed the headroom budget: operation can ASK for 0.9 CPU,
    // but on a 4-core system the headroom might cap it at 0.625.
    // Then FPS-based throttling can reduce it further.
    capped.cpuBudget = Math.min(capped.cpuBudget, this._cpuHeadroom);

    // ─── Memory cap ───────────────────────────────────
    // If we know total RAM and current usage exceeds 70% of headroom,
    // force aggressive GC and reduce budget further.
    if (this._memHeadroomMb > 0 && this._currentMemoryMb > 0) {
      const usageRatio = this._currentMemoryMb / this._memHeadroomMb;
      if (usageRatio > 0.85) {
        // Danger zone: near the headroom ceiling
        capped.cpuBudget = Math.min(capped.cpuBudget, 0.3);
        capped.gcStrategy = "aggressive";
        capped.backgroundTaskThreshold = Infinity;
      } else if (usageRatio > 0.7) {
        // Warning zone: scaling back
        capped.cpuBudget = Math.min(capped.cpuBudget, 0.45);
        capped.gcStrategy = "aggressive";
      }
    }

    // ─── Low-end device floor ─────────────────────────
    // On low-end devices (< 4 cores / <= 4GB), never go above
    // 60% CPU even if the headroom math allows it.
    if (this._isLowEndDevice) {
      capped.cpuBudget = Math.min(capped.cpuBudget, 0.6);
      if (capped.animationQuality === "high") capped.animationQuality = "medium";
    }

    return capped;
  }

  /**
   * Adjust a profile based on real-time performance feedback.
   * When FPS drops or memory is high, reduce resource consumption.
   */
  private adjustProfile(profile: ResourceProfile): ResourceProfile {
    const adjusted = { ...profile };

    // Scale down CPU budget when FPS is low
    if (this._currentFps < 30 && this._currentFps > 0) {
      adjusted.cpuBudget = Math.max(0.1, profile.cpuBudget * 0.5);
    } else if (this._currentFps < 45) {
      adjusted.cpuBudget = Math.max(0.15, profile.cpuBudget * 0.75);
    }

    // Reduce animation when overloaded
    if (this._isOverloaded) {
      adjusted.animationQuality = "low";
      adjusted.renderPriority = false;
      adjusted.virtualizationLevel = "minimal";
      adjusted.backgroundTaskThreshold = Infinity;
    }

    // Aggressive GC when memory is high (>500MB)
    if (this._currentMemoryMb > 500) {
      adjusted.gcStrategy = "aggressive";
    }

    return adjusted;
  }

  /** Apply the current resource profile as CSS custom properties */
  private applyProfile(): void {
    if (typeof document === "undefined") return;

    const profile = this.computeProfile();
    const root = document.documentElement;

    root.dataset.schedulerAnimation = profile.animationQuality;
    root.dataset.schedulerPriority = profile.renderPriority ? "high" : "normal";
    root.dataset.schedulerVirtualization = profile.virtualizationLevel;

    // CSS custom properties for finer-grained control
    root.style.setProperty("--scheduler-cpu-budget", String(profile.cpuBudget));
    root.style.setProperty("--scheduler-gc", profile.gcStrategy);

    // ─── Critical visual quality override ────────────────
    // When renderPriority is true (user-facing operation like searching,
    // loading, or editing), we MUST protect visual quality — especially
    // backdrop-filter blur on the search overlay.  The performance monitor
    // sets data-performance-mode="low" which globally forces:
    //   backdrop-filter: none !important;
    // This makes the search overlay's frosted-glass effect disappear.
    //
    // By clearing data-performance-mode during render-critical ops, the
    // backdrop-filter stays fully visible.  The scheduler still manages
    // overload via its own feedFps() loop, so we don't lose performance
    // protection — we just don't hammer the visual experience with a
    // heavy-handed CSS blanket rule.
    //
    // When renderPriority is true (user-facing ops like searching),
    // remove the performance monitor's blanket backdrop-filter: none
    // override so frosted-glass effects stay visible.  The scheduler's
    // own feedFps() loop handles overload protection independently.
    if (profile.renderPriority) {
      root.removeAttribute("data-performance-mode");
    }

    if (!this._cssVarsApplied) {
      this._cssVarsApplied = true;
    }
  }

  // ─── Performance Monitor Feedback ──────────────────────

  /**
   * Feed FPS data to the scheduler. Called by PerformanceMonitor.
   */
  feedFps(fps: number): void {
    // Smooth the FPS value to avoid jitter
    this._currentFps = Math.round(this._currentFps * 0.7 + fps * 0.3);

    // Detect overload: sustained low FPS
    if (this._currentFps < 24) {
      this._overloadCount++;
      if (this._overloadCount >= 3 && !this._isOverloaded) {
        this._isOverloaded = true;
        this.applyProfile();
        this.emitState();
        console.info(`[Scheduler] Overloaded (${this._currentFps} FPS). Reducing resource consumption.`);
      }
    } else if (this._currentFps > 40) {
      this._overloadCount = Math.max(0, this._overloadCount - 1);
      if (this._overloadCount === 0 && this._isOverloaded) {
        this._isOverloaded = false;
        this.applyProfile();
        this.emitState();
        console.info(`[Scheduler] Recovered (${this._currentFps} FPS). Restoring resource allocation.`);
      }
    }
  }

  /**
   * Feed memory data to the scheduler.
   */
  feedMemory(mb: number): void {
    this._currentMemoryMb = this._currentMemoryMb * 0.7 + mb * 0.3;
  }

  // ─── Background Task Queue ─────────────────────────────

  /**
   * Schedule a background task. It runs during idle periods
   * based on the current resource profile.
   */
  scheduleTask(task: ScheduledTask): void {
    this.taskQueue.add(task);
    this.emitState();
  }

  /** Unschedule a background task */
  unscheduleTask(id: string): void {
    this.taskQueue.remove(id);
    this.emitState();
  }

  /** Process one tick of the background task queue */
  private tickBgTasks(): void {
    if (!this.monitoring) return;
    this.taskQueue.tick(this.computeProfile());
  }

  // ─── Interaction Detection ────────────────────────────

  /**
   * Bind passive event listeners to detect user interaction.
   * When the user moves the mouse, scrolls, touches, or types,
   * the scheduler enters the "interacting" profile so scroll
   * performance, hover effects, and input feel smooth at 60fps.
   * After INTERACTION_IDLE_TIMEOUT ms of no input, it falls back
   * to "idle".
   *
   * All listeners are passive to never block the browser's
   * scrolling / touch handling.
   */
  private startInteractionDetection(): void {
    if (this._boundOnInteraction || typeof document === "undefined") return;

    this._boundOnInteraction = (e: Event): void => {
      // Throttle mousemove/scroll to ~100ms to avoid per-frame flapping
      const now = performance.now();
      if (e.type === "mousemove" || e.type === "scroll" || e.type === "pointermove") {
        if (now - this._interactionThrottle < 100) return;
        this._interactionThrottle = now;
      }

      // Don't override higher-priority operations
      const dominant = this.getDominantOperation();
      if (dominant && PRIORITY_ORDER[dominant.priority] > PRIORITY_ORDER.low) return;

      this.beginOperation("interacting");

      // Reset idle timer
      if (this._interactionTimer) clearTimeout(this._interactionTimer);
      this._interactionTimer = setTimeout(() => {
        this.endOperation("interacting");
        this._interactionTimer = null;
      }, this.INTERACTION_IDLE_TIMEOUT);
    };

    for (const eventType of this.INTERACTION_EVENTS) {
      document.addEventListener(eventType, this._boundOnInteraction, { passive: true });
    }
  }

  /** Remove interaction event listeners */
  private stopInteractionDetection(): void {
    if (!this._boundOnInteraction || typeof document === "undefined") return;
    for (const eventType of this.INTERACTION_EVENTS) {
      document.removeEventListener(eventType, this._boundOnInteraction);
    }
    this._boundOnInteraction = null;
    if (this._interactionTimer) {
      clearTimeout(this._interactionTimer);
      this._interactionTimer = null;
    }
    this.endOperation("interacting");
  }

  /**
   * Per-frame guard: when a render-critical operation is active,
   * ensure the performance monitor's blanket backdrop-filter kill
   * (`data-performance-mode="low"`) doesn't take effect.
   *
   * The performance monitor's reactive watch and overload callback
   * can re-set `data-performance-mode` at ANY time.  Running this
   * every frame is the only way to guarantee the rule stays off.
   * It's practically free when the attribute is already "auto".
   */
  private protectRenderQuality(): void {
    if (typeof document === "undefined") return;
    const dominant = this.getDominantOperation();
    if (!dominant) return;
    const profile = DEFAULT_PROFILES[dominant.type];
    if (profile?.renderPriority) {
      // Only write when the value actually changes — avoids per-frame style recalc
      if (this._lastPerformanceMode !== "auto") {
        this._lastPerformanceMode = "auto";
        document.documentElement.dataset.performanceMode = "auto";
      }
    } else if (this._lastPerformanceMode !== null) {
      this._lastPerformanceMode = null;
    }
  }

  // ─── Monitoring Loop ───────────────────────────────────

  /** Start the scheduler's internal monitoring loop */
  start(): void {
    if (this.monitoring) return;
    this.monitoring = true;

    // Detect device capabilities and calculate safe headroom limits
    this.detectDeviceCapabilities();
    console.info(
      `[Scheduler] Device: ${this._cpuCores} cores, ${this._totalMemoryMb}MB RAM, ` +
        `headroom: ${Math.round(this._cpuHeadroom * 100)}% CPU, ${Math.round(this._memHeadroomMb)}MB memory`,
    );

    // Start detecting user interaction to keep the UI responsive
    this.startInteractionDetection();

    const loop = (): void => {
      if (!this.monitoring) return;
      this.tickBgTasks();
      // Per-frame quality guard for backdrop-filter and other visual effects
      this.protectRenderQuality();
      this.monitorRafId = requestAnimationFrame(loop);
    };

    this.monitorRafId = requestAnimationFrame(loop);
    console.info("[Scheduler] Started resource scheduler.");
  }

  /** Stop the monitoring loop */
  stop(): void {
    this.monitoring = false;
    if (this.monitorRafId !== null) {
      cancelAnimationFrame(this.monitorRafId);
      this.monitorRafId = null;
    }
    this.stopInteractionDetection();
    this.clearPrediction();
    this.deprewarm();
    this.taskQueue.clear();
    this.operations.clear();
    console.info("[Scheduler] Stopped resource scheduler.");
  }

  // ─── Event System ──────────────────────────────────────

  /** Subscribe to scheduler state changes */
  onStateChange(listener: SchedulerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitState(): void {
    const state = this.state;
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.warn("[Scheduler] Listener error:", err);
      }
    }
  }

  // ─── Utilities ─────────────────────────────────────────

  /** Get the priority-based profile for a specific operation type */
  getProfileFor(type: OperationType): ResourceProfile {
    return { ...DEFAULT_PROFILES[type] };
  }

  /** Get the animation quality level from the current profile */
  getAnimationQuality(): ResourceProfile["animationQuality"] {
    return this.computeProfile().animationQuality;
  }

  /** Check if the system is currently overloaded */
  get isOverloaded(): boolean {
    return this._isOverloaded;
  }

  /** Get current FPS */
  get currentFps(): number {
    return this._currentFps;
  }
}

// Singleton export
const scheduler = new ResourceScheduler();
export default scheduler;
export { ResourceScheduler, PriorityTaskQueue };
