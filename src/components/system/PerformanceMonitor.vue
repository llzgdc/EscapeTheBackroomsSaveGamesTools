<template>
  <div class="perf-monitor">
    <h3>{{ t("performanceMonitor.title") }}</h3>
    <div class="stats">
      <div class="stat-item">
        <span><font-awesome-icon :icon="['fas', 'bolt']" /> {{ t("performanceMonitor.fps") }}: {{ fps }}</span>
        <div class="rating" :class="fpsRating.class">
          <font-awesome-icon :icon="['fas', fpsRating.icon]" />
        </div>
      </div>
      <div class="stat-item">
        <span
          ><font-awesome-icon :icon="['fas', 'database']" /> {{ t("performanceMonitor.memory") }}:
          {{ formatMemory(memory.usedJSHeapSize) }} / {{ formatMemory(memory.totalJSHeapSize) }}</span
        >
        <div class="rating" :class="memoryRating.class">
          <font-awesome-icon :icon="['fas', memoryRating.icon]" />
        </div>
      </div>
      <div class="stat-item">
        <span
          ><font-awesome-icon :icon="['fas', 'microchip']" /> {{ t("performanceMonitor.cpu") }}:
          {{ cpuLoad.toFixed(1) }}%</span
        >
        <div class="rating" :class="cpuRating.class">
          <font-awesome-icon :icon="['fas', cpuRating.icon]" />
        </div>
      </div>
      <div>
        <font-awesome-icon :icon="['fas', 'clock']" /> {{ t("performanceMonitor.renderTime") }}:
        {{ loadTime.toFixed(2) }} ms
      </div>
    </div>

    <div class="charts">
      <canvas ref="fpsChart"></canvas>
      <canvas ref="memChart"></canvas>
      <canvas ref="cpuChart"></canvas>
    </div>
  </div>
</template>

<script>
import { markRaw } from "vue";
import { useI18n } from "vue-i18n";

export default {
  name: "PerformanceMonitor",
  setup() {
    const { t } = useI18n({ useScope: "global" });
    return { t };
  },
  data() {
    return {
      fps: 0,
      memory: { usedJSHeapSize: 0, totalJSHeapSize: 0 },
      cpuLoad: 0,
      loadTime: 0,
      frame: null,
      lastFrameTime: performance.now(),
      lastFpsTime: performance.now(),
      lastSampleTime: performance.now(),
      lastCpuCheck: performance.now(),
      cpuIdle: 0,
      visibilityHandler: null,
      paused: false,
      sampleInterval: 1000, // 采样间隔从 500ms 增加到 1000ms，减少 CPU 开销
      frameCount: 0,
      fpsData: [],
      memData: [],
      cpuData: [],
      Chart: null, // 动态加载的 Chart 类
      chartsLoaded: false,
    };
  },
  computed: {
    // FPS评估 (绿色线)
    fpsRating() {
      // FPS评分 (满帧60为优秀，但考虑实际情况调整评级标准)
      const fpsScore = Math.min(100, (this.fps / 60) * 100);

      if (fpsScore >= 80) {
        // 48 FPS以上为优秀
        return {
          class: "excellent",
          icon: "star",
        };
      } else if (fpsScore >= 60) {
        // 36 FPS以上为良好
        return {
          class: "good",
          icon: "thumbs-up",
        };
      } else if (fpsScore >= 40) {
        // 24 FPS以上为一般
        return {
          class: "average",
          icon: "minus",
        };
      } else if (fpsScore >= 20) {
        // 12 FPS以上为较差
        return {
          class: "poor",
          icon: "exclamation-triangle",
        };
      } else {
        return {
          class: "terrible",
          icon: "times",
        };
      }
    },

    // 内存评估 (蓝色线)
    memoryRating() {
      // 内存评分 (使用率越低越好，但考虑实际情况调整评级标准)
      const memoryUsage = this.memory.totalJSHeapSize
        ? (this.memory.usedJSHeapSize / this.memory.totalJSHeapSize) * 100
        : 0;
      const memoryScore = Math.max(0, 100 - memoryUsage);

      if (memoryScore >= 85) {
        // 内存使用率15%以下为优秀
        return {
          class: "excellent",
          icon: "star",
        };
      } else if (memoryScore >= 70) {
        // 内存使用率30%以下为良好
        return {
          class: "good",
          icon: "thumbs-up",
        };
      } else if (memoryScore >= 50) {
        // 内存使用率50%以下为一般
        return {
          class: "average",
          icon: "minus",
        };
      } else if (memoryScore >= 30) {
        // 内存使用率70%以下为较差
        return {
          class: "poor",
          icon: "exclamation-triangle",
        };
      } else {
        return {
          class: "terrible",
          icon: "times",
        };
      }
    },

    // CPU评估 (橙色线)
    cpuRating() {
      // CPU评分 (使用率越低越好，但考虑实际情况调整评级标准)
      const cpuScore = Math.max(0, 100 - this.cpuLoad);

      if (cpuScore >= 90) {
        // CPU使用率10%以下为优秀
        return {
          class: "excellent",
          icon: "star",
        };
      } else if (cpuScore >= 75) {
        // CPU使用率25%以下为良好
        return {
          class: "good",
          icon: "thumbs-up",
        };
      } else if (cpuScore >= 50) {
        // CPU使用率50%以下为一般
        return {
          class: "average",
          icon: "minus",
        };
      } else if (cpuScore >= 25) {
        // CPU使用率75%以下为较差
        return {
          class: "poor",
          icon: "exclamation-triangle",
        };
      } else {
        return {
          class: "terrible",
          icon: "times",
        };
      }
    },
  },
  async mounted() {
    // 使用现代API获取页面加载时间
    const navigationEntry = performance.getEntriesByType("navigation")[0];
    if (navigationEntry) {
      // 使用loadEventEnd - fetchStart来计算页面加载时间
      this.loadTime = navigationEntry.loadEventEnd - navigationEntry.fetchStart;
    } else if (performance.timing) {
      // 降级到旧API（兼容旧浏览器）
      this.loadTime = performance.timing.loadEventEnd - performance.timing.fetchStart;
    } else {
      // 如果都不支持，设置为0
      this.loadTime = 0;
    }

    // 动态加载 Chart.js - 仅在组件实际显示时加载
    await this.loadChartJS();

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.paused = true;
        if (this.frame) {
          cancelAnimationFrame(this.frame);
          this.frame = null;
        }
        return;
      }
      this.paused = false;
      this.lastFrameTime = performance.now();
      this.lastFpsTime = performance.now();
      this.lastSampleTime = performance.now();
      this.startMonitoring();
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
    this.startMonitoring();
  },
  beforeUnmount() {
    cancelAnimationFrame(this.frame);
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.fpsChart?.destroy();
    this.memChart?.destroy();
    this.cpuChart?.destroy();
  },
  methods: {
    async loadChartJS() {
      try {
        // 动态导入 Chart.js - 仅在组件实际显示时加载
        const chartModule = await import("chart.js");
        const { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale } = chartModule;

        // 注册必要的组件
        Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale);

        this.Chart = markRaw(Chart);
        this.chartsLoaded = true;

        // 初始化图表
        this.$nextTick(() => {
          this.initCharts();
        });
      } catch (error) {
        console.warn("Failed to load Chart.js:", error);
        this.chartsLoaded = false;
      }
    },
    startMonitoring() {
      if (this.frame || this.paused) return;
      const loop = (now) => {
        if (this.paused) return;

        // FPS (每秒统计一次，更稳定)
        this.frameCount++;
        if (now - this.lastFpsTime >= 1000) {
          this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
          this.frameCount = 0;
          this.lastFpsTime = now;
          // Feed FPS to resource scheduler
          window.dispatchEvent(new CustomEvent("scheduler-fps", { detail: this.fps }));
        }

        // CPU (事件循环延迟估算)
        const elapsed = now - this.lastCpuCheck;
        this.cpuIdle = 0.95 * this.cpuIdle + 0.05 * Math.min(elapsed, 50);
        this.cpuLoad = Math.min(100, (1 - this.cpuIdle / 50) * 100);
        this.lastCpuCheck = now;

        // 低频率采样，降低监控开销
        if (now - this.lastSampleTime >= this.sampleInterval) {
          if (performance.memory) {
            this.memory = {
              usedJSHeapSize: performance.memory.usedJSHeapSize,
              totalJSHeapSize: performance.memory.totalJSHeapSize,
            };
            // Feed memory data to resource scheduler
            window.dispatchEvent(
              new CustomEvent("scheduler-memory", {
                detail: this.memory.usedJSHeapSize / 1024 / 1024,
              }),
            );
          }
          // 更新数据数组（最多保存 60 点）
          this.updateData();
          this.lastSampleTime = now;
        }

        // 下一帧
        this.frame = requestAnimationFrame(loop);
      };
      this.frame = requestAnimationFrame(loop);
    },
    updateData() {
      // 如果页面不可见，跳过数据更新
      if (this.paused) return;

      const maxPoints = 30; // 从 60 点减少到 30 点，减少内存和渲染开销

      this.fpsData.push(this.fps);
      this.memData.push(this.memory.usedJSHeapSize / 1024 / 1024);
      this.cpuData.push(this.cpuLoad);

      if (this.fpsData.length > maxPoints) this.fpsData.shift();
      if (this.memData.length > maxPoints) this.memData.shift();
      if (this.cpuData.length > maxPoints) this.cpuData.shift();

      // 使用 requestIdleCallback 延迟更新图表，避免阻塞主线程
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => this.updateCharts(), { timeout: 200 });
      } else {
        // 降级方案：使用 setTimeout
        setTimeout(() => this.updateCharts(), 0);
      }
    },
    initCharts() {
      // 如果 Chart.js 未加载成功，跳过初始化
      if (!this.chartsLoaded || !this.Chart) return;

      const commonOptions = {
        responsive: true,
        animation: false,
        devicePixelRatio: 1,
        maintainAspectRatio: false,
        elements: { point: { radius: 0 } },
        scales: {
          x: { display: false },
          y: { beginAtZero: true },
        },
        plugins: { legend: { display: false } },
      };

      this.fpsChart = markRaw(
        new this.Chart(this.$refs.fpsChart, {
          type: "line",
          data: {
            labels: [],
            datasets: [{ label: "FPS", borderColor: "lime", data: [] }],
          },
          options: commonOptions,
        }),
      );

      this.memChart = markRaw(
        new this.Chart(this.$refs.memChart, {
          type: "line",
          data: {
            labels: [],
            datasets: [{ label: "Memory (MB)", borderColor: "cyan", data: [] }],
          },
          options: commonOptions,
        }),
      );

      this.cpuChart = markRaw(
        new this.Chart(this.$refs.cpuChart, {
          type: "line",
          data: {
            labels: [],
            datasets: [{ label: "CPU (%)", borderColor: "orange", data: [] }],
          },
          options: commonOptions,
        }),
      );
    },
    updateCharts() {
      // 如果图表未加载，跳过更新
      if (!this.chartsLoaded || !this.fpsChart || !this.memChart || !this.cpuChart) return;

      // 直接更新数据引用，避免创建新数组
      this.fpsChart.data.labels = this.fpsData.map((_, i) => i);
      this.fpsChart.data.datasets[0].data = this.fpsData;
      this.fpsChart.update("none");

      this.memChart.data.labels = this.memData.map((_, i) => i);
      this.memChart.data.datasets[0].data = this.memData;
      this.memChart.update("none");

      this.cpuChart.data.labels = this.cpuData.map((_, i) => i);
      this.cpuChart.data.datasets[0].data = this.cpuData;
      this.cpuChart.update("none");
    },
    formatMemory(bytes) {
      if (!bytes) return "N/A";
      return (bytes / 1024 / 1024).toFixed(1) + " MB";
    },
  },
};
</script>

<style scoped>
.perf-monitor {
  width: 100%;
  background: transparent;
  color: #0f0;
  font-family: monospace;
  font-size: 12px;
  padding: 10px;
  border-radius: var(--radius-md);
  /* 默认半透明，不干扰主界面 */
  opacity: 0.3;
  transition: opacity 0.2s ease;
}

.perf-monitor:hover {
  /* hover 时完全可见可读 */
  opacity: 1;
}

.perf-monitor h3 {
  margin: 0 0 5px;
  font-size: 14px;
  color: #fff;
}

.stats {
  margin-bottom: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.rating {
  font-size: 12px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-circle);
}

.rating.excellent {
  background-color: #4caf50;
  color: white;
}

.rating.good {
  background-color: #8bc34a;
  color: white;
}

.rating.average {
  background-color: #ffeb3b;
  color: black;
}

.rating.poor {
  background-color: #ff9800;
  color: white;
}

.rating.terrible {
  background-color: #f44336;
  color: white;
}

.charts canvas {
  width: 100% !important;
  height: 80px !important;
  margin-bottom: 8px;
}
</style>
