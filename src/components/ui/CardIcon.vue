<script setup lang="ts">
import type { Component } from 'vue'
import {
  PhRocketLaunch, PhLightning, PhBomb, PhWaveSine, PhSword, PhFire,
  PhArrowsClockwise, PhShieldPlus, PhMagnet, PhDrop,
  PhDiamondsFour, PhGhost, PhShootingStar, PhTrendUp,
  PhAtom, PhSpiral, PhWind, PhTarget, PhSparkle,
  PhAirplaneTilt, PhPlanet, PhStar, PhCrosshair,
} from '@phosphor-icons/vue'

const ICON_MAP: Record<string, Component> = {
  PhRocketLaunch, PhLightning, PhBomb, PhWaveSine, PhSword, PhFire,
  PhArrowsClockwise, PhShieldPlus, PhMagnet, PhDrop,
  PhDiamondsFour, PhGhost, PhShootingStar, PhTrendUp,
  PhAtom, PhSpiral, PhWind, PhTarget, PhSparkle,
  PhAirplaneTilt, PhPlanet, PhStar, PhCrosshair,
}

const COLOR_MAP: Record<string, string> = {
  // Attack — warm reds & oranges
  PhRocketLaunch:   '#ff6b6b',
  PhLightning:      '#c678f5',
  PhBomb:           '#ff8c3a',
  PhWaveSine:       '#00e5ff',
  PhSword:          '#ff8080',
  PhFire:           '#ff6030',
  PhCrosshair:      '#ff4d6d',
  PhTarget:         '#ff4444',
  // Support — blues & greens
  PhArrowsClockwise:'#26de81',
  PhShieldPlus:     '#45aaf2',
  PhMagnet:         '#a29bfe',
  PhDrop:           '#ff5e7a',
  PhTrendUp:        '#00cec9',
  PhWind:           '#74b9ff',
  // Ultimate — gold & luminous
  PhDiamondsFour:   '#ffd700',
  PhGhost:          '#cdd6f4',
  PhShootingStar:   '#ffd700',
  PhAtom:           '#fd79a8',
  PhSpiral:         '#b39ddb',
  PhSparkle:        '#ffeaa7',
  // Avatars
  PhAirplaneTilt:   '#74b9ff',
  PhPlanet:         '#a29bfe',
  PhStar:           '#ffd700',
}

const props = defineProps<{
  name: string
  size?: number
  weight?: string
  color?: string
}>()
</script>

<template>
  <component
    v-if="ICON_MAP[name]"
    :is="ICON_MAP[name]"
    :size="props.size ?? 28"
    :weight="props.weight ?? 'fill'"
    :color="props.color ?? COLOR_MAP[name] ?? 'currentColor'"
  />
</template>
