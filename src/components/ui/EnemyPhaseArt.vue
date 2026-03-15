<script setup lang="ts">
import { ref } from 'vue'
import type { EnemyKind } from '../../game/types'
import PixiEnemyArt from './PixiEnemyArt.vue'

/**
 * Map of art key -> (kind, displayPhase)
 * Used to render enemy phases in the codex
 */
const phaseArtMap: Record<string, { kind: EnemyKind; phase: string }> = {
  // Pioneer
  'pioneer_enter': { kind: 'pioneer', phase: 'enter' },
  'pioneer_patrol': { kind: 'pioneer', phase: 'patrol' },
  'pioneer_press': { kind: 'pioneer', phase: 'approach' },

  // Kamikaze
  'kamikaze_lock': { kind: 'kamikaze', phase: 'aim' },
  'kamikaze_charge': { kind: 'kamikaze', phase: 'charge' },
  'kamikaze_prexplode': { kind: 'kamikaze', phase: 'prexplode' },

  // Sniper
  'sniper_aim': { kind: 'sniper', phase: 'aim' },
  'sniper_shot': { kind: 'sniper', phase: 'shot' },

  // Đại Liên
  'dailien_hold': { kind: 'dai_lien', phase: 'hold' },
  'dailien_burst': { kind: 'dai_lien', phase: 'burst' },

  // Thủ Hộ
  'thuho_guard': { kind: 'thu_ho', phase: 'guard' },
  'thuho_reflect': { kind: 'thu_ho', phase: 'reflect' },

  // Thuật Sĩ
  'thuatsi_heal': { kind: 'thuat_si', phase: 'heal' },
  'thuatsi_meteor': { kind: 'thuat_si', phase: 'meteor' },

  // Cnox Greedy
  'greedy_absorb': { kind: 'cnox_greedy', phase: 'absorb' },
  'greedy_evolve': { kind: 'cnox_greedy', phase: 'evolve' },

  // Cnox Shield
  'shield_form': { kind: 'cnox_shield', phase: 'form' },
  'shield_push': { kind: 'cnox_shield', phase: 'push' },

  // Cnox Spark
  'spark_warning': { kind: 'cnox_spark', phase: 'warning' },
  'spark_fire': { kind: 'cnox_spark', phase: 'fire' },
  'spark_cd': { kind: 'cnox_spark', phase: 'cooldown' },

  // Boss Star Destroyer
  'sd_phase1': { kind: 'boss_stardestroyer', phase: '1' },
  'sd_phase2': { kind: 'boss_stardestroyer', phase: '2' },
  'sd_phase3': { kind: 'boss_stardestroyer', phase: '3' },

  // Boss Invader
  'inv_turret': { kind: 'boss_invader', phase: 'turret' },
  'inv_zone': { kind: 'boss_invader', phase: 'zone' },
  'inv_pressure': { kind: 'boss_invader', phase: 'pressure' },

  // Boss Tính Vân
  'tv_orbit': { kind: 'boss_tinhvan', phase: 'orbit' },
  'tv_blackhole': { kind: 'boss_tinhvan', phase: 'blackhole' },
  'tv_summon': { kind: 'boss_tinhvan', phase: 'summon' },

  // Boss Trùm Số
  'trum_machinegun': { kind: 'boss_trumso', phase: 'machinegun' },
  'trum_missile': { kind: 'boss_trumso', phase: 'missile' },
  'trum_charge_laser': { kind: 'boss_trumso', phase: 'laser' },

  // Boss Cnox Sun
  'sun_stars': { kind: 'boss_cnox_sun', phase: 'stars' },
  'sun_crystal': { kind: 'boss_cnox_sun', phase: 'crystal' },
  'sun_core_laser': { kind: 'boss_cnox_sun', phase: 'laser' },
}

const props = withDefaults(defineProps<{
  art: string
  size?: number
}>(), {
  size: 120,
})

const phaseData = ref(phaseArtMap[props.art] ?? { kind: 'pioneer' as EnemyKind, phase: 'default' })
</script>

<template>
  <div class="phase-art-container" :style="{ width: size + 'px', height: Math.round(size * 0.63) + 'px' }">
    <div class="phase-art-background">
      <PixiEnemyArt :kind="phaseData.kind" :size="size" :phase="phaseData.phase" />
    </div>
    <svg class="phase-art-overlay" :viewBox="'0 0 120 76'" :width="size" :height="Math.round(size * 0.63)">
      <!-- Phase-specific decorations/indicators -->
      
      <!-- Kamikaze Aim - Lock Indicator -->
      <g v-if="art === 'kamikaze_lock'">
        <circle cx="60" cy="36" r="15" fill="none" stroke="#ff6e6e" stroke-width="2" opacity="0.6"/>
        <line x1="60" y1="15" x2="60" y2="6" stroke="#ff6e6e" stroke-width="1.5" opacity="0.5"/>
        <line x1="60" y1="57" x2="60" y2="66" stroke="#ff6e6e" stroke-width="1.5" opacity="0.5"/>
        <line x1="39" y1="36" x2="30" y2="36" stroke="#ff6e6e" stroke-width="1.5" opacity="0.5"/>
        <line x1="81" y1="36" x2="90" y2="36" stroke="#ff6e6e" stroke-width="1.5" opacity="0.5"/>
      </g>

      <!-- Kamikaze Charge - Speed trails -->
      <g v-else-if="art === 'kamikaze_charge'">
        <line x1="12" y1="57" x2="46" y2="45" stroke="#ffd2d2" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.5"/>
      </g>

      <!-- Kamikaze Prexplode - Explosion rings -->
      <g v-else-if="art === 'kamikaze_prexplode'">
        <circle cx="60" cy="38" r="18" fill="none" stroke="#ff6a4f" stroke-width="1.5" opacity="0.4"/>
        <circle cx="60" cy="38" r="25" fill="none" stroke="#ff6a4f" stroke-width="1" stroke-dasharray="3 2" opacity="0.3"/>
      </g>

      <!-- Sniper Aim - Targeting reticle -->
      <g v-else-if="art === 'sniper_aim'">
        <line x1="52" y1="38" x2="98" y2="22" stroke="#ff8b8b" stroke-width="1" opacity="0.5"/>
        <circle cx="100" cy="21" r="4" fill="none" stroke="#ff8b8b" stroke-width="1" opacity="0.5"/>
      </g>

      <!-- Sniper Shot - Bullet trail -->
      <g v-else-if="art === 'sniper_shot'">
        <line x1="49" y1="38" x2="106" y2="38" stroke="#ffd9d9" stroke-width="2" opacity="0.4"/>
      </g>

      <!-- Đại Liên Burst - Projectile indicator -->
      <g v-else-if="art === 'dailien_burst'">
        <circle cx="78" cy="36" r="2" fill="#ffb35e" opacity="0.6"/>
        <circle cx="90" cy="36" r="2" fill="#ffb35e" opacity="0.6"/>
        <circle cx="102" cy="36" r="2" fill="#ffb35e" opacity="0.6"/>
      </g>

      <!-- Thủ Hộ Reflect - Reflection aura -->
      <g v-else-if="art === 'thuho_reflect'">
        <circle cx="60" cy="36" r="16" fill="none" stroke="#fff29a" stroke-width="1.5" opacity="0.5"/>
        <line x1="28" y1="36" x2="44" y2="36" stroke="#fff29a" stroke-width="1" opacity="0.4"/>
      </g>

      <!-- Thuật Sĩ Heal - Healing beam -->
      <g v-else-if="art === 'thuatsi_heal'">
        <line x1="42" y1="36" x2="78" y2="36" stroke="#86ffc6" stroke-width="2" opacity="0.5"/>
      </g>

      <!-- Cnox Spark Warning - Cone warning -->
      <g v-else-if="art === 'spark_warning'">
        <line x1="22" y1="62" x2="98" y2="10" stroke="#ffb6ff" stroke-width="1" stroke-dasharray="3 2" opacity="0.4"/>
      </g>

      <!-- Cnox Spark Fire - Beam -->
      <g v-else-if="art === 'spark_fire'">
        <line x1="34" y1="34" x2="100" y2="34" stroke="#ffffff" stroke-width="3" opacity="0.3"/>
        <line x1="34" y1="34" x2="100" y2="34" stroke="#cf9fff" stroke-width="6" opacity="0.15"/>
      </g>

      <!-- Star Destroyer phase indicators -->
      <g v-else-if="art === 'sd_phase2'">
        <line x1="60" y1="32" x2="104" y2="18" stroke="#ff8ea8" stroke-width="1" opacity="0.4"/>
        <line x1="60" y1="32" x2="104" y2="46" stroke="#ff8ea8" stroke-width="1" opacity="0.4"/>
      </g>

      <g v-else-if="art === 'sd_phase3'">
        <!-- Multiple attack indicators -->
        <line x1="62" y1="23" x2="76" y2="28" stroke="#ff9f66" stroke-width="0.8" opacity="0.4"/>
        <line x1="62" y1="40" x2="76" y2="45" stroke="#ff9f66" stroke-width="0.8" opacity="0.4"/>
      </g>

      <!-- Boss Invader zone -->
      <g v-else-if="art === 'inv_zone'">
        <circle cx="88" cy="50" r="14" fill="none" stroke="#d29bff" stroke-width="1.5" opacity="0.4"/>
        <circle cx="88" cy="50" r="6" fill="#d29bff" opacity="0.2"/>
      </g>

      <!-- Boss Tính Vân orbit -->
      <g v-else-if="art === 'tv_orbit'">
        <circle cx="60" cy="36" r="12" fill="none" stroke="#c8a3ff" stroke-width="1" opacity="0.3" stroke-dasharray="2 2"/>
      </g>

      <!-- Boss Tính Vân blackhole -->
      <g v-else-if="art === 'tv_blackhole'">
        <circle cx="60" cy="36" r="12" fill="none" stroke="#8c4bdb" stroke-width="1.5" opacity="0.4"/>
        <circle cx="60" cy="36" r="20" fill="none" stroke="#6d2fc0" stroke-width="0.8" opacity="0.3"/>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.phase-art-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.phase-art-background {
  position: absolute;
  inset: 0;
}

.phase-art-overlay {
  position: relative;
  z-index: 10;
  display: block;
}
</style>
