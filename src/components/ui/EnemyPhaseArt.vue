<script setup lang="ts">
withDefaults(defineProps<{
  art: string
  size?: number
}>(), {
  size: 120,
})
</script>

<template>
  <svg :viewBox="'0 0 120 76'" :width="size" :height="Math.round(size * 0.63)" class="phase-art">
    <rect x="1" y="1" width="118" height="74" rx="8" fill="#0c1529" stroke="#304569" stroke-width="2"/>

    <g v-if="art === 'pioneer_enter'">
      <rect x="48" y="8" width="24" height="14" fill="#2fd6ff"/>
      <line x1="60" y1="22" x2="60" y2="56" stroke="#8fc8ff" stroke-width="2" stroke-dasharray="4 3"/>
      <polygon points="60,61 55,52 65,52" fill="#8fc8ff"/>
    </g>
    <g v-else-if="art === 'pioneer_patrol'">
      <path d="M 20 45 Q 45 18 72 42 Q 92 59 103 33" fill="none" stroke="#79b8ff" stroke-width="2"/>
      <circle cx="24" cy="43" r="4" fill="#2fd6ff"/>
      <circle cx="74" cy="43" r="4" fill="#2fd6ff"/>
    </g>
    <g v-else-if="art === 'pioneer_press'">
      <rect x="18" y="24" width="12" height="8" fill="#3f7fca"/>
      <rect x="38" y="24" width="12" height="8" fill="#3f7fca"/>
      <rect x="58" y="24" width="12" height="8" fill="#3f7fca"/>
      <rect x="78" y="24" width="12" height="8" fill="#3f7fca"/>
      <line x1="14" y1="50" x2="106" y2="50" stroke="#ff9f5a" stroke-width="2"/>
    </g>

    <g v-else-if="art === 'kamikaze_lock'">
      <circle cx="60" cy="36" r="15" fill="none" stroke="#ff6e6e" stroke-width="2"/>
      <line x1="60" y1="15" x2="60" y2="6" stroke="#ff6e6e" stroke-width="2"/>
      <line x1="60" y1="57" x2="60" y2="66" stroke="#ff6e6e" stroke-width="2"/>
      <line x1="39" y1="36" x2="30" y2="36" stroke="#ff6e6e" stroke-width="2"/>
      <line x1="81" y1="36" x2="90" y2="36" stroke="#ff6e6e" stroke-width="2"/>
    </g>
    <g v-else-if="art === 'kamikaze_charge'">
      <polygon points="18,54 54,40 52,33 88,19 86,31 101,29 82,46 84,57 49,50 47,44" fill="#ff5959"/>
      <line x1="12" y1="57" x2="46" y2="45" stroke="#ffd2d2" stroke-width="2" stroke-dasharray="4 2"/>
    </g>
    <g v-else-if="art === 'kamikaze_prexplode'">
      <circle cx="60" cy="38" r="12" fill="#ffae67"/>
      <circle cx="60" cy="38" r="18" fill="none" stroke="#ff6a4f" stroke-width="2"/>
      <circle cx="60" cy="38" r="25" fill="none" stroke="#ff6a4f" stroke-width="1" stroke-dasharray="3 2"/>
    </g>

    <g v-else-if="art === 'sniper_aim'">
      <rect x="24" y="33" width="28" height="10" fill="#65708f"/>
      <line x1="52" y1="38" x2="98" y2="22" stroke="#ff8b8b" stroke-width="2"/>
      <circle cx="100" cy="21" r="4" fill="none" stroke="#ff8b8b" stroke-width="2"/>
    </g>
    <g v-else-if="art === 'sniper_shot'">
      <rect x="20" y="33" width="30" height="10" fill="#65708f"/>
      <line x1="49" y1="38" x2="106" y2="38" stroke="#ffd9d9" stroke-width="3"/>
      <circle cx="106" cy="38" r="5" fill="#ff6e6e"/>
    </g>

    <g v-else-if="art === 'dailien_hold'">
      <rect x="26" y="30" width="18" height="14" fill="#6175b4"/>
      <rect x="50" y="30" width="18" height="14" fill="#6175b4"/>
      <rect x="74" y="30" width="18" height="14" fill="#6175b4"/>
    </g>
    <g v-else-if="art === 'dailien_burst'">
      <rect x="50" y="28" width="20" height="16" fill="#6175b4"/>
      <circle cx="78" cy="36" r="3" fill="#ffb35e"/>
      <circle cx="90" cy="36" r="3" fill="#ffb35e"/>
      <circle cx="102" cy="36" r="3" fill="#ffb35e"/>
    </g>

    <g v-else-if="art === 'thuho_guard'">
      <polygon points="60,14 82,28 74,58 46,58 38,28" fill="#49b2ff"/>
      <circle cx="60" cy="36" r="6" fill="#d8f3ff"/>
    </g>
    <g v-else-if="art === 'thuho_reflect'">
      <polygon points="60,14 82,28 74,58 46,58 38,28" fill="#49b2ff"/>
      <circle cx="60" cy="36" r="16" fill="none" stroke="#fff29a" stroke-width="2"/>
      <line x1="28" y1="36" x2="44" y2="36" stroke="#fff29a" stroke-width="2"/>
    </g>

    <g v-else-if="art === 'thuatsi_heal'">
      <rect x="24" y="26" width="18" height="20" fill="#6f5ec9"/>
      <rect x="78" y="26" width="18" height="20" fill="#5675c9"/>
      <line x1="42" y1="36" x2="78" y2="36" stroke="#86ffc6" stroke-width="3"/>
    </g>
    <g v-else-if="art === 'thuatsi_meteor'">
      <circle cx="40" cy="24" r="9" fill="#a694ff"/>
      <path d="M 45 28 L 90 58" stroke="#ffb26f" stroke-width="5"/>
      <path d="M 39 28 L 82 54" stroke="#ffe2b5" stroke-width="2"/>
    </g>

    <g v-else-if="art === 'greedy_absorb'">
      <circle cx="50" cy="36" r="12" fill="#ff9c5e"/>
      <circle cx="78" cy="24" r="4" fill="#85c4ff"/>
      <path d="M 72 28 Q 64 34 56 34" fill="none" stroke="#85c4ff" stroke-width="2"/>
    </g>
    <g v-else-if="art === 'greedy_evolve'">
      <circle cx="44" cy="38" r="9" fill="#ff9c5e"/>
      <circle cx="78" cy="38" r="15" fill="#ff9c5e"/>
      <line x1="56" y1="38" x2="66" y2="38" stroke="#9effc9" stroke-width="2"/>
      <polygon points="66,38 61,34 61,42" fill="#9effc9"/>
    </g>

    <g v-else-if="art === 'shield_form'">
      <rect x="18" y="32" width="16" height="12" fill="#63b3e8"/>
      <rect x="38" y="32" width="16" height="12" fill="#63b3e8"/>
      <rect x="58" y="32" width="16" height="12" fill="#63b3e8"/>
      <rect x="78" y="32" width="16" height="12" fill="#63b3e8"/>
    </g>
    <g v-else-if="art === 'shield_push'">
      <rect x="30" y="30" width="20" height="14" fill="#63b3e8"/>
      <rect x="54" y="30" width="20" height="14" fill="#63b3e8"/>
      <line x1="24" y1="58" x2="92" y2="58" stroke="#ffd38f" stroke-width="2" stroke-dasharray="4 3"/>
    </g>

    <g v-else-if="art === 'spark_warning'">
      <polygon points="60,14 72,34 60,58 48,34" fill="#b596ff"/>
      <line x1="22" y1="62" x2="98" y2="10" stroke="#ffb6ff" stroke-width="2" stroke-dasharray="5 3"/>
    </g>
    <g v-else-if="art === 'spark_fire'">
      <polygon points="34,34 48,34 86,34 100,34" fill="#f9dfff"/>
      <line x1="34" y1="34" x2="100" y2="34" stroke="#ffffff" stroke-width="4"/>
      <line x1="34" y1="34" x2="100" y2="34" stroke="#cf9fff" stroke-width="8" opacity="0.4"/>
    </g>
    <g v-else-if="art === 'spark_cd'">
      <circle cx="60" cy="36" r="16" fill="none" stroke="#8ca5d9" stroke-width="2"/>
      <path d="M 60 20 A 16 16 0 0 1 74 44" fill="none" stroke="#d6e4ff" stroke-width="3"/>
    </g>

    <g v-else-if="art === 'sd_phase1'">
      <rect x="28" y="24" width="44" height="16" fill="#4b62a6"/>
      <circle cx="78" cy="32" r="3" fill="#ffb56b"/>
      <circle cx="88" cy="32" r="3" fill="#ffb56b"/>
    </g>
    <g v-else-if="art === 'sd_phase2'">
      <rect x="24" y="24" width="36" height="16" fill="#4b62a6"/>
      <line x1="60" y1="32" x2="104" y2="18" stroke="#ff8ea8" stroke-width="2"/>
      <line x1="60" y1="32" x2="104" y2="46" stroke="#ff8ea8" stroke-width="2"/>
    </g>
    <g v-else-if="art === 'sd_phase3'">
      <rect x="24" y="24" width="34" height="16" fill="#4b62a6"/>
      <polygon points="62,23 76,28 64,34" fill="#ff9f66"/>
      <polygon points="62,40 76,45 64,51" fill="#ff9f66"/>
      <polygon points="78,31 94,36 82,42" fill="#ff9f66"/>
    </g>

    <g v-else-if="art === 'inv_turret'">
      <rect x="20" y="22" width="80" height="22" rx="5" fill="#345bc0"/>
      <rect x="12" y="28" width="8" height="10" fill="#7ea8ff"/>
      <rect x="100" y="28" width="8" height="10" fill="#7ea8ff"/>
    </g>
    <g v-else-if="art === 'inv_zone'">
      <rect x="20" y="22" width="52" height="18" fill="#345bc0"/>
      <circle cx="88" cy="50" r="14" fill="none" stroke="#d29bff" stroke-width="2"/>
      <circle cx="88" cy="50" r="6" fill="#d29bff"/>
    </g>
    <g v-else-if="art === 'inv_pressure'">
      <rect x="20" y="22" width="52" height="18" fill="#345bc0"/>
      <circle cx="82" cy="28" r="3" fill="#ff7d7d"/>
      <circle cx="94" cy="36" r="3" fill="#ff7d7d"/>
      <circle cx="104" cy="44" r="3" fill="#ff7d7d"/>
    </g>

    <g v-else-if="art === 'tv_orbit'">
      <circle cx="50" cy="36" r="14" fill="#7a49c3"/>
      <circle cx="74" cy="20" r="4" fill="#c8a3ff"/>
      <circle cx="86" cy="35" r="4" fill="#c8a3ff"/>
      <circle cx="75" cy="52" r="4" fill="#c8a3ff"/>
    </g>
    <g v-else-if="art === 'tv_blackhole'">
      <circle cx="60" cy="36" r="5" fill="#090013"/>
      <circle cx="60" cy="36" r="12" fill="none" stroke="#8c4bdb" stroke-width="2"/>
      <circle cx="60" cy="36" r="20" fill="none" stroke="#6d2fc0" stroke-width="1"/>
    </g>
    <g v-else-if="art === 'tv_summon'">
      <ellipse cx="60" cy="36" rx="20" ry="12" fill="none" stroke="#bd8dff" stroke-width="2"/>
      <ellipse cx="60" cy="36" rx="10" ry="6" fill="#7a49c3"/>
    </g>

    <g v-else-if="art === 'trum_machinegun'">
      <rect x="20" y="22" width="44" height="22" fill="#6f3bbb"/>
      <circle cx="74" cy="30" r="3" fill="#ffbc7b"/>
      <circle cx="84" cy="34" r="3" fill="#ffbc7b"/>
      <circle cx="94" cy="38" r="3" fill="#ffbc7b"/>
    </g>
    <g v-else-if="art === 'trum_missile'">
      <rect x="20" y="22" width="44" height="22" fill="#6f3bbb"/>
      <polygon points="72,28 88,34 72,40" fill="#ff9ca5"/>
      <polygon points="88,34 105,40 89,46" fill="#ff9ca5"/>
    </g>
    <g v-else-if="art === 'trum_charge_laser'">
      <rect x="20" y="22" width="44" height="22" fill="#6f3bbb"/>
      <line x1="64" y1="33" x2="108" y2="33" stroke="#ffd5ff" stroke-width="3"/>
      <line x1="64" y1="33" x2="108" y2="33" stroke="#ff98ef" stroke-width="7" opacity="0.35"/>
    </g>

    <g v-else-if="art === 'sun_stars'">
      <circle cx="44" cy="38" r="11" fill="#ffb45b"/>
      <circle cx="82" cy="22" r="4" fill="#9dcfff"/>
      <circle cx="96" cy="38" r="4" fill="#ffc977"/>
      <circle cx="82" cy="54" r="4" fill="#d7a8ff"/>
    </g>
    <g v-else-if="art === 'sun_crystal'">
      <circle cx="42" cy="38" r="11" fill="#ffb45b"/>
      <polygon points="88,20 96,36 88,52 80,36" fill="#8fd6ff"/>
      <line x1="53" y1="38" x2="80" y2="36" stroke="#8fd6ff" stroke-width="2"/>
    </g>
    <g v-else-if="art === 'sun_core_laser'">
      <circle cx="36" cy="38" r="10" fill="#ffb45b"/>
      <line x1="46" y1="38" x2="108" y2="28" stroke="#ffe8b8" stroke-width="3"/>
      <line x1="46" y1="38" x2="108" y2="28" stroke="#ff9f64" stroke-width="8" opacity="0.3"/>
    </g>
  </svg>
</template>

<style scoped>
.phase-art {
  display: block;
}
</style>
