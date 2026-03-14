<script setup lang="ts">
import { computed } from 'vue'
import type { EnemyKind } from '../../game/types'

const props = withDefaults(defineProps<{
  kind: EnemyKind
  size?: number
  locked?: boolean
}>(), {
  size: 82,
  locked: false,
})

const viewSize = computed(() => Math.max(64, props.size))
</script>

<template>
  <svg :viewBox="'-40 -40 80 80'" :width="viewSize" :height="viewSize" class="codex-art" :class="{ 'codex-art--locked': locked }">
    <g v-if="locked">
      <rect x="-38" y="-38" width="76" height="76" rx="10" fill="#0b0b0b" stroke="#252525" stroke-width="2"/>
      <circle cx="0" cy="-3" r="15" fill="#181818" stroke="#3a3a3a" stroke-width="2"/>
      <text x="0" y="6" text-anchor="middle" font-size="20" fill="#707070" font-family="'Chakra Petch', sans-serif">?</text>
    </g>

    <g v-else-if="kind === 'pioneer'">
      <polygon points="-11,0 -26,14 -11,8" fill="#2f72b9"/>
      <polygon points="11,0 26,14 11,8" fill="#2f72b9"/>
      <rect x="-10" y="-20" width="20" height="30" fill="#2fd6ff"/>
      <rect x="-5" y="-20" width="10" height="10" fill="#ffd84d"/>
      <rect x="-6" y="11" width="12" height="8" fill="#ff7a2b" opacity="0.9"/>
    </g>

    <g v-else-if="kind === 'kamikaze'">
      <polygon points="0,-28 9,-10 0,20 -9,-10" fill="#ff4545"/>
      <polygon points="-16,0 -8,4 -13,13" fill="#ff8a8a"/>
      <polygon points="16,0 8,4 13,13" fill="#ff8a8a"/>
      <circle cx="0" cy="-3" r="4" fill="#fff2a6"/>
    </g>

    <g v-else-if="kind === 'sniper'">
      <rect x="-10" y="-20" width="20" height="28" fill="#4a5674"/>
      <polygon points="0,-30 8,-20 -8,-20" fill="#9fb7ff"/>
      <rect x="-22" y="-7" width="44" height="3" fill="#ff6666"/>
      <circle cx="0" cy="-5.5" r="4" fill="#ffd0d0"/>
    </g>

    <g v-else-if="kind === 'dai_lien'">
      <rect x="-14" y="-14" width="28" height="28" rx="4" fill="#5a6ba7"/>
      <rect x="-5" y="-26" width="10" height="13" fill="#92b0ff"/>
      <rect x="-23" y="-2" width="10" height="4" fill="#ffad4f"/>
      <rect x="13" y="-2" width="10" height="4" fill="#ffad4f"/>
      <circle cx="0" cy="0" r="5" fill="#d7e1ff"/>
    </g>

    <g v-else-if="kind === 'thu_ho'">
      <polygon points="0,-24 20,-8 14,18 -14,18 -20,-8" fill="#35a4ff"/>
      <polygon points="0,-16 13,-5 9,11 -9,11 -13,-5" fill="#8fd2ff"/>
      <circle cx="0" cy="0" r="3" fill="#ffffff"/>
    </g>

    <g v-else-if="kind === 'thuat_si'">
      <polygon points="0,-22 18,-6 12,20 -12,20 -18,-6" fill="#6a56c4"/>
      <circle cx="0" cy="-4" r="8" fill="#b6a7ff"/>
      <rect x="-2" y="8" width="4" height="16" fill="#f1ddff"/>
      <circle cx="0" cy="24" r="3" fill="#90ffb8"/>
    </g>

    <g v-else-if="kind === 'cnox_greedy'">
      <circle cx="0" cy="0" r="19" fill="#ff9354"/>
      <circle cx="0" cy="0" r="12" fill="#ffd0a1"/>
      <circle cx="-6" cy="-3" r="2" fill="#4b250e"/>
      <circle cx="6" cy="-3" r="2" fill="#4b250e"/>
      <path d="M -7 6 Q 0 11 7 6" stroke="#4b250e" stroke-width="2" fill="none"/>
    </g>

    <g v-else-if="kind === 'cnox_shield'">
      <rect x="-16" y="-16" width="32" height="32" rx="5" fill="#4ea4e4"/>
      <rect x="-12" y="-12" width="24" height="24" rx="4" fill="#b6ecff"/>
      <rect x="-4" y="-20" width="8" height="7" fill="#5dc4ff"/>
    </g>

    <g v-else-if="kind === 'cnox_spark'">
      <polygon points="0,-24 8,-6 24,0 8,6 0,24 -8,6 -24,0 -8,-6" fill="#b07dff"/>
      <circle cx="0" cy="0" r="7" fill="#efe2ff"/>
      <circle cx="0" cy="0" r="3" fill="#ffffff"/>
    </g>

    <g v-else-if="kind === 'boss_stardestroyer'">
      <rect x="-26" y="-18" width="52" height="34" fill="#3b4f8e"/>
      <polygon points="0,-30 14,-18 -14,-18" fill="#94a7e7"/>
      <rect x="-30" y="-5" width="8" height="4" fill="#ffa657"/>
      <rect x="22" y="-5" width="8" height="4" fill="#ffa657"/>
      <circle cx="0" cy="-6" r="5" fill="#dce8ff"/>
    </g>

    <g v-else-if="kind === 'boss_invader'">
      <rect x="-30" y="-20" width="60" height="40" rx="8" fill="#2a4ba9"/>
      <rect x="-36" y="-4" width="12" height="8" fill="#6fa0ff"/>
      <rect x="24" y="-4" width="12" height="8" fill="#6fa0ff"/>
      <rect x="-8" y="-28" width="16" height="12" fill="#9ec2ff"/>
      <circle cx="0" cy="0" r="7" fill="#f0f6ff"/>
    </g>

    <g v-else-if="kind === 'boss_tinhvan'">
      <circle cx="0" cy="0" r="24" fill="#5f2ca4"/>
      <circle cx="0" cy="0" r="16" fill="#9b68e6"/>
      <circle cx="0" cy="0" r="7" fill="#efe1ff"/>
      <path d="M -30 0 Q 0 -16 30 0" stroke="#d7b8ff" stroke-width="2" fill="none" opacity="0.7"/>
    </g>

    <g v-else-if="kind === 'boss_trumso'">
      <rect x="-28" y="-20" width="56" height="40" rx="6" fill="#5d2da8"/>
      <rect x="-34" y="-6" width="10" height="12" fill="#9d72d8"/>
      <rect x="24" y="-6" width="10" height="12" fill="#9d72d8"/>
      <circle cx="0" cy="-3" r="8" fill="#f1dcff"/>
      <rect x="-10" y="14" width="20" height="5" fill="#ff8ee6"/>
    </g>

    <g v-else-if="kind === 'boss_cnox_sun'">
      <circle cx="0" cy="0" r="22" fill="#ffac4a"/>
      <circle cx="0" cy="0" r="12" fill="#ffe1ab"/>
      <circle cx="0" cy="-30" r="5" fill="#9eceff"/>
      <circle cx="28" cy="0" r="5" fill="#ffcf6f"/>
      <circle cx="0" cy="30" r="5" fill="#d6a6ff"/>
      <circle cx="-28" cy="0" r="5" fill="#ff9ca0"/>
    </g>
  </svg>
</template>

<style scoped>
.codex-art {
  display: block;
}
.codex-art--locked {
  filter: grayscale(1);
}
</style>
