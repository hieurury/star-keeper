<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Application, Graphics, Container } from 'pixi.js'
import type { EnemyKind } from '../../game/types'
import { drawPioneer } from '../../game/entities/Pioneer'
import { drawKamikaze } from '../../game/entities/Kamikaze'
import { drawSniper } from '../../game/entities/Sniper'
import { drawDaiLien } from '../../game/entities/DaiLien'
import { drawThuHo } from '../../game/entities/ThuHo'
import { drawThuatSi, drawThuatSiMeteor } from '../../game/entities/ThuatSi'
import { drawCnoxGreedy } from '../../game/entities/CnoxGreedy'
import { drawCnoxShieldBody } from '../../game/entities/CnoxShield'
import { drawCnoxSpark } from '../../game/entities/CnoxSpark'
import { drawSunBossBody } from '../../game/entities/BossCnoxSun'

import { drawBossInvader } from '../../game/entities/BossInvader'
import { drawStarDestroyer } from '../../game/entities/BossStarDestroyer'
import { drawBossTinhVan } from '../../game/entities/BossTinhVan'
import { drawBossTrumSo } from '../../game/entities/BossTrumSo'

interface Props {
  kind: EnemyKind
  size?: number
  phase?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 82,
  phase: 'default',
})

const container = ref<HTMLDivElement>()
let app: Application | null = null

// Map of enemy kinds to their draw functions
const drawFunctions: Record<string, (g: Graphics, size: number) => void> = {
  'pioneer': drawPioneer,
  'kamikaze': drawKamikaze,
  'sniper': drawSniper,
  'dai_lien': drawDaiLien,
  'thu_ho': drawThuHo,
  'thuat_si': drawThuatSi,
  'cnox_shield': drawCnoxShieldBody,
  'cnox_spark': drawCnoxSpark,
  'boss_cnox_sun': drawSunBossBody,

  'boss_invader': drawBossInvader,
  'boss_stardestroyer': drawStarDestroyer,
  'boss_tinhvan': drawBossTinhVan,
  'boss_trumso': drawBossTrumSo,
}

function renderEnemy() {
  if (!app || !container.value) return

  app.stage.removeChildren()

  const displaySize = Math.min(props.size, 120)
  const enemySize = displaySize * 0.7  // Scale up for better visibility

  // Handle special phase rendering
  if (props.phase && props.phase !== 'default') {
    renderPhaseArt()
    return
  }

  const g = new Graphics()
  
  // Handle special cases with custom parameters
  if (props.kind === 'cnox_greedy') {
    drawCnoxGreedy(g, enemySize, 0)
  } else if (props.kind === 'thu_ho') {
    drawThuHo(g, enemySize, false)
  } else {
    const drawFn = drawFunctions[props.kind]
    if (drawFn) drawFn(g, enemySize)
  }

  // Use container wrapper to center the graphics
  const wrapper = new Container()
  wrapper.x = props.size
  wrapper.y = props.size
  wrapper.addChild(g)

  app.stage.addChild(wrapper)
}

function renderPhaseArt() {
  if (!app) return

  app.stage.removeChildren()

  const displaySize = Math.min(props.size, 120)
  const size = displaySize * 0.65
  const g = new Graphics()
  
  // Container wrapper positioned at center
  const wrapper = new Container()
  wrapper.x = props.size / 2
  wrapper.y = props.size / 2

  // Phase-specific rendering
  switch (props.phase) {
    case 'kamikaze_aim':
      // Draw kamikaze with aiming indicator
      drawKamikaze(g, size)
      const aimCircle = new Graphics()
      aimCircle.circle(0, 0, size * 1.3).stroke({ color: 0xff6600, width: 1, alpha: 0.6 })
      wrapper.addChild(g, aimCircle)
      break

    case 'thuat_si_meteor':
      drawThuatSiMeteor(g, size)
      wrapper.addChild(g)
      break

    case 'thu_ho_reflect':
      drawThuHo(g, size, true)
      const reflectGlow = new Graphics()
      reflectGlow.circle(0, 0, size * 1.6).stroke({ color: 0xffff88, width: 1.5, alpha: 0.7 })
      wrapper.addChild(g, reflectGlow)
      break

    default:
      // Default rendering
      const drawFn = drawFunctions[props.kind]
      if (drawFn) drawFn(g, size)
      wrapper.addChild(g)
  }

  app.stage.addChild(wrapper)
}

async function initPixi() {
  if (!container.value) return

  app = new Application()
  const dpi = window.devicePixelRatio || 1
  const resolution = dpi > 1 ? 2 : 1
  
  await app.init({
    width: props.size * resolution,
    height: props.size * resolution,
    backgroundColor: 0x0f1a2a,
    antialias: true,
    resolution,
  })

  container.value.appendChild(app.canvas as HTMLCanvasElement)
  const canvas = app.canvas as HTMLCanvasElement
  canvas.style.display = 'block'
  canvas.style.width = props.size + 'px'
  canvas.style.height = props.size + 'px'
  canvas.style.imageRendering = 'crisp-edges'

  renderEnemy()
}

watch(() => props.kind, () => renderEnemy())
watch(() => props.phase, () => renderEnemy())
watch(() => props.size, () => renderEnemy())

onMounted(initPixi)

onUnmounted(() => {
  if (app) {
    app.destroy()
    app = null
  }
})
</script>

<template>
  <div ref="container" class="pixi-enemy-art" :style="{ width: size + 'px', height: size + 'px' }"></div>
</template>

<style scoped>
.pixi-enemy-art {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #0f1a2a;
  overflow: hidden;
  position: relative;
}

:deep(canvas) {
  display: block !important;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
