<script setup lang="ts">
import { computed } from 'vue'
import { useFluidStore } from '../store/fluid'

const store = useFluidStore()

const progressPercent = computed(() => {
  const p = store.analysisProgress
  if (!p) return 0
  return Math.round((p.frame / p.totalFrames) * 100)
})

const DIMENSION_ICONS: Record<string, string> = {
  meanSpeed: '🚀',
  peakSpeed: '⚡',
  speedStdDev: '📊',
  displacement: '📏',
  densityFluctuation: '💧',
}

function runAnalysis() {
  store.runComparison()
}

function formatValue(key: string, value: number): string {
  if (key === 'meanSpeed' || key === 'peakSpeed') return value.toFixed(1)
  return value.toFixed(0)
}
</script>

<template>
  <div class="w-full bg-gray-800 rounded-lg border border-gray-700 p-4">
    <div class="flex items-center justify-between mb-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-200">场景对比分析</h3>
        <p class="text-xs text-gray-500 mt-0.5">自动量化各场景粒子运动剧烈程度</p>
      </div>
      <button
        @click="runAnalysis"
        :disabled="store.isAnalyzing"
        class="text-xs px-3 py-1.5 rounded transition whitespace-nowrap"
        :class="store.isAnalyzing
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white'"
      >
        {{ store.isAnalyzing ? '分析中...' : '运行对比' }}
      </button>
    </div>

    <!-- Progress -->
    <div v-if="store.isAnalyzing && store.analysisProgress" class="mb-3">
      <div class="flex justify-between text-xs text-gray-400 mb-1">
        <span>{{ store.analysisProgress.presetLabel }}</span>
        <span>
          {{ store.analysisProgress.presetIndex + 1 }}/{{ store.analysisProgress.presetTotal }}
          · {{ progressPercent }}%
        </span>
      </div>
      <div class="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
        <div
          class="bg-blue-500 h-full transition-all duration-150"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <!-- Results -->
    <div v-if="store.comparisonResult">
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="bg-gradient-to-br from-red-900/40 to-red-800/20 border border-red-700/40 rounded p-2.5">
          <div class="text-[10px] text-red-300 mb-0.5 flex items-center gap-1">
            <span>🔥</span> 最剧烈
          </div>
          <div class="text-sm font-bold text-red-200">
            {{ store.comparisonResult.summary.mostIntense.label }}
          </div>
          <div class="text-lg font-black text-red-300 mt-0.5">
            {{ store.comparisonResult.summary.mostIntense.intensityScore }}
            <span class="text-[10px] font-normal text-red-400/70">/100</span>
          </div>
        </div>
        <div class="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-700/40 rounded p-2.5">
          <div class="text-[10px] text-green-300 mb-0.5 flex items-center gap-1">
            <span>🍃</span> 最平缓
          </div>
          <div class="text-sm font-bold text-green-200">
            {{ store.comparisonResult.summary.leastIntense.label }}
          </div>
          <div class="text-lg font-black text-green-300 mt-0.5">
            {{ store.comparisonResult.summary.leastIntense.intensityScore }}
            <span class="text-[10px] font-normal text-green-400/70">/100</span>
          </div>
        </div>
      </div>

      <!-- Dimension Leaders -->
      <div class="mb-3">
        <h4 class="text-xs font-semibold text-gray-400 mb-1.5">单项冠军</h4>
        <div class="grid grid-cols-5 gap-1.5">
          <div
            v-for="leader in store.comparisonResult.dimensionLeaders"
            :key="leader.key"
            class="bg-gray-900/60 border border-gray-700/50 rounded p-1.5 text-center"
          >
            <div class="text-sm mb-0.5">{{ DIMENSION_ICONS[leader.key] }}</div>
            <div class="text-[9px] text-gray-500 leading-tight mb-0.5 truncate" :title="leader.label">
              {{ leader.label }}
            </div>
            <div class="text-[11px] font-semibold text-purple-300 truncate" :title="leader.label_zh">
              {{ leader.label_zh }}
            </div>
            <div class="text-[10px] font-mono text-gray-400 mt-0.5">
              {{ formatValue(leader.key, leader.value) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Conclusion -->
      <div class="bg-blue-900/30 border border-blue-700/50 rounded p-3 mb-3">
        <p class="text-xs text-blue-200 leading-relaxed whitespace-pre-line">
          {{ store.comparisonResult.conclusion }}
        </p>
      </div>

      <!-- Metrics table -->
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-500 border-b border-gray-700">
              <th class="text-left py-1.5 pr-2 font-medium">场景</th>
              <th class="text-right py-1.5 px-2 font-medium">平均速度</th>
              <th class="text-right py-1.5 px-2 font-medium">峰值速度</th>
              <th class="text-right py-1.5 px-2 font-medium">速度波动</th>
              <th class="text-right py-1.5 px-2 font-medium">位移</th>
              <th class="text-right py-1.5 px-2 font-medium">密度波动</th>
              <th class="text-right py-1.5 pl-2 font-medium">剧烈度</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(m, i) in store.comparisonResult.ranking"
              :key="m.presetName"
              class="border-b border-gray-700/50"
              :class="{
                'bg-blue-600/20': i === 0,
                'bg-green-600/10': i === store.comparisonResult.ranking.length - 1,
              }"
            >
              <td class="py-1.5 pr-2 text-gray-200 whitespace-nowrap">
                <span
                  class="mr-1"
                  :class="{
                    'text-gray-500': true,
                    'text-red-400': i === 0,
                    'text-green-400': i === store.comparisonResult.ranking.length - 1,
                  }"
                >{{ i + 1 }}.</span>{{ m.label }}
              </td>
              <td class="text-right py-1.5 px-2 text-gray-300 font-mono">{{ m.meanSpeed.toFixed(1) }}</td>
              <td class="text-right py-1.5 px-2 text-gray-300 font-mono">{{ m.peakSpeed.toFixed(0) }}</td>
              <td class="text-right py-1.5 px-2 text-gray-300 font-mono">{{ m.speedStdDev.toFixed(1) }}</td>
              <td class="text-right py-1.5 px-2 text-gray-300 font-mono">{{ m.displacement.toFixed(0) }}</td>
              <td class="text-right py-1.5 px-2 text-gray-300 font-mono">{{ m.densityFluctuation.toFixed(0) }}</td>
              <td
                class="text-right py-1.5 pl-2 font-mono font-bold"
                :class="{
                  'text-blue-300': i === 0,
                  'text-green-300': i === store.comparisonResult.ranking.length - 1,
                  'text-gray-400': i > 0 && i < store.comparisonResult.ranking.length - 1,
                }"
              >
                {{ m.intensityScore }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!store.isAnalyzing" class="text-xs text-gray-500 py-2">
      点击「运行对比」，将无头模拟各场景并自动生成剧烈度对比结论
    </div>
  </div>
</template>
