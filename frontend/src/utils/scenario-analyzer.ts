import { SPHEngine, DEFAULT_PARAMS, PRESETS } from './sph-engine'
import type { Preset } from '../types'

export interface DimensionLeader {
  key: string
  label: string
  presetName: string
  label_zh: string
  value: number
}

export interface ScenarioMetrics {
  presetName: string
  label: string
  description: string
  meanSpeed: number
  peakSpeed: number
  speedStdDev: number
  displacement: number
  densityFluctuation: number
  intensityScore: number
}

export interface ComparisonResult {
  metrics: ScenarioMetrics[]
  ranking: ScenarioMetrics[]
  conclusion: string
  dimensionLeaders: DimensionLeader[]
  summary: {
    mostIntense: ScenarioMetrics
    leastIntense: ScenarioMetrics
    overallRanking: string
    intensityGap: number
  }
}

export interface AnalyzeProgress {
  presetIndex: number
  presetTotal: number
  presetLabel: string
  frame: number
  totalFrames: number
}

const ANALYSIS_FRAMES = 300
const SAMPLE_INTERVAL = 5
const SUB_STEPS = 3
const YIELD_INTERVAL = 30

const CANVAS_W = 800
const CANVAS_H = 500

export async function analyzePreset(
  preset: Preset,
  onProgress?: (p: AnalyzeProgress) => void,
  presetIndex = 0,
  presetTotal = 1
): Promise<ScenarioMetrics> {
  const params = { ...DEFAULT_PARAMS, ...preset.params }
  const engine = new SPHEngine(preset.particleCount, CANVAS_W, CANVAS_H, params)
  engine.initParticles(preset.initialConfig, preset.particleCount)

  const initialPositions = engine.particles.map((p) => ({ x: p.x, y: p.y }))

  const speedSamples: number[] = []
  const densitySamples: number[] = []
  let peakSpeed = 0

  for (let frame = 0; frame < ANALYSIS_FRAMES; frame++) {
    for (let s = 0; s < SUB_STEPS; s++) {
      engine.step()
    }
    if (frame % SAMPLE_INTERVAL === 0) {
      let speedSum = 0
      let densitySum = 0
      for (const p of engine.particles) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        speedSum += speed
        if (speed > peakSpeed) peakSpeed = speed
        densitySum += p.density
      }
      const n = engine.particles.length || 1
      speedSamples.push(speedSum / n)
      densitySamples.push(densitySum / n)
    }
    if (frame % YIELD_INTERVAL === 0) {
      onProgress?.({
        presetIndex,
        presetTotal,
        presetLabel: preset.label,
        frame,
        totalFrames: ANALYSIS_FRAMES,
      })
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  const meanSpeed =
    speedSamples.reduce((a, b) => a + b, 0) / (speedSamples.length || 1)
  const speedStdDev = Math.sqrt(
    speedSamples.reduce((s, v) => s + (v - meanSpeed) ** 2, 0) /
      (speedSamples.length || 1)
  )

  let dispSum = 0
  for (let i = 0; i < engine.particles.length; i++) {
    const p = engine.particles[i]
    const init = initialPositions[i]
    const dx = p.x - init.x
    const dy = p.y - init.y
    dispSum += Math.sqrt(dx * dx + dy * dy)
  }
  const displacement = dispSum / (engine.particles.length || 1)

  const meanDensity =
    densitySamples.reduce((a, b) => a + b, 0) / (densitySamples.length || 1)
  const densityFluctuation = Math.sqrt(
    densitySamples.reduce((s, v) => s + (v - meanDensity) ** 2, 0) /
      (densitySamples.length || 1)
  )

  return {
    presetName: preset.name,
    label: preset.label,
    description: preset.description,
    meanSpeed,
    peakSpeed,
    speedStdDev,
    displacement,
    densityFluctuation,
    intensityScore: 0,
  }
}

export async function runComparison(
  presets: Preset[] = PRESETS,
  onProgress?: (p: AnalyzeProgress) => void
): Promise<ComparisonResult> {
  const metrics: ScenarioMetrics[] = []
  for (let i = 0; i < presets.length; i++) {
    const m = await analyzePreset(presets[i], onProgress, i, presets.length)
    metrics.push(m)
  }

  type MetricKey =
    | 'meanSpeed'
    | 'peakSpeed'
    | 'speedStdDev'
    | 'displacement'
    | 'densityFluctuation'

  const DIMENSION_LABELS: Record<MetricKey, string> = {
    meanSpeed: '平均速度最高',
    peakSpeed: '峰值速度最高',
    speedStdDev: '速度波动最大',
    displacement: '平均位移最远',
    densityFluctuation: '密度波动最大',
  }

  const normalize = (key: MetricKey) => {
    const vals = metrics.map((m) => m[key])
    const max = Math.max(...vals)
    const min = Math.min(...vals)
    const range = max - min
    return (v: number) => (range > 0 ? (v - min) / range : 0.5)
  }

  const normMean = normalize('meanSpeed')
  const normPeak = normalize('peakSpeed')
  const normStd = normalize('speedStdDev')
  const normDisp = normalize('displacement')
  const normDens = normalize('densityFluctuation')

  for (const m of metrics) {
    m.intensityScore = Math.round(
      (normMean(m.meanSpeed) * 0.25 +
        normPeak(m.peakSpeed) * 0.2 +
        normStd(m.speedStdDev) * 0.2 +
        normDisp(m.displacement) * 0.25 +
        normDens(m.densityFluctuation) * 0.1) *
        100
    )
  }

  const ranking = [...metrics].sort((a, b) => b.intensityScore - a.intensityScore)

  const dimensionKeys: MetricKey[] = [
    'meanSpeed',
    'peakSpeed',
    'speedStdDev',
    'displacement',
    'densityFluctuation',
  ]
  const dimensionLeaders = dimensionKeys.map((key) => {
    const leader = [...metrics].sort((a, b) => b[key] - a[key])[0]
    return {
      key,
      label: DIMENSION_LABELS[key],
      presetName: leader.presetName,
      label_zh: leader.label,
      value: leader[key],
    }
  })

  const mostIntense = ranking[0]
  const leastIntense = ranking[ranking.length - 1]
  const summary = {
    mostIntense,
    leastIntense,
    overallRanking: ranking.map((m, i) => `${i + 1}.${m.label}`).join(' > '),
    intensityGap: mostIntense.intensityScore - leastIntense.intensityScore,
  }

  const conclusion = generateConclusion(ranking, dimensionLeaders, summary)

  return { metrics, ranking, conclusion, dimensionLeaders, summary }
}

function generateConclusion(
  ranking: ScenarioMetrics[],
  leaders: DimensionLeader[],
  summary: ComparisonResult['summary']
): string {
  const { mostIntense, leastIntense, intensityGap } = summary
  const parts: string[] = []

  parts.push(
    `【综合结论】「${mostIntense.label}」变化最为剧烈（剧烈度 ${mostIntense.intensityScore}/100），「${leastIntense.label}」最为平缓（${leastIntense.intensityScore}/100），两者差距 ${intensityGap} 分。`
  )

  const topDims = leaders.filter((l) => l.presetName === mostIntense.presetName)
  if (topDims.length > 0) {
    parts.push(
      `「${mostIntense.label}」在${topDims.map((d) => `「${d.label}」`).join('、')}维度上均领先，${
        mostIntense.presetName === 'fountain'
          ? '持续向上喷射的机制使其粒子长期处于高速运动状态。'
          : mostIntense.presetName === 'dam'
          ? '溃坝瞬间释放大量势能，导致大范围冲击和扩散。'
          : mostIntense.presetName === 'drop'
          ? '水滴从高处自由落体，撞击底部产生强烈反弹和飞溅。'
          : '波浪传播过程中粒子持续振荡，位移积累显著。'
      }`
    )
  }

  const weakDims = leaders.filter((l) => l.presetName === leastIntense.presetName)
  if (weakDims.length === 0) {
    parts.push(
      `「${leastIntense.label}」在各维度表现均不突出，` +
        (leastIntense.presetName === 'wave'
          ? '正弦波虽有形态变化但整体速度和位移相对温和。'
          : leastIntense.presetName === 'drop'
          ? '粒子在撞击后能量逐渐耗散，最终趋于平静。'
          : leastIntense.presetName === 'fountain'
          ? '虽然持续喷射，但粒子上升后回落的规律性较强。'
          : '水体在扩散后逐渐趋于稳定。'
        )
    )
  }

  parts.push(
    `【单项冠军】${leaders
      .map((l) => {
        const fmt =
          l.key === 'meanSpeed' || l.key === 'peakSpeed'
            ? l.value.toFixed(1)
            : l.value.toFixed(0)
        return `${l.label}：「${l.label_zh}」(${fmt})`
      })
      .join('；')}。`
  )

  parts.push(`【剧烈度排序】${summary.overallRanking}`)
  return parts.join('')
}
