<script setup lang="ts">
defineProps<{ id: string; size?: number }>()
</script>

<template>
  <!-- Neutron Star: gold 5-point star -->
  <svg v-if="id === 'neutron_star'" :width="size ?? 24" :height="size ?? 24" viewBox="-12 -12 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle r="11.5" fill="rgba(255,215,0,0.18)"/>
    <polygon points="0,-9 2.1,-2.9 8.6,-2.9 3.4,1.1 5.3,7.3 0,3.5 -5.3,7.3 -3.4,1.1 -8.6,-2.9 -2.1,-2.9" fill="#ffe566" stroke="#cc9900" stroke-width="0.6"/>
    <circle r="2.2" fill="white"/>
  </svg>

  <!-- Carbon Core: dark hexagon crystal -->
  <svg v-else-if="id === 'carbon_core'" :width="size ?? 24" :height="size ?? 24" viewBox="-10 -10 20 20" xmlns="http://www.w3.org/2000/svg">
    <polygon points="6,0 3,5.2 -3,5.2 -6,0 -3,-5.2 3,-5.2" fill="#3a3a5c" stroke="#8888bb" stroke-width="1.2"/>
    <polygon points="3,0 1.5,2.6 -1.5,2.6 -3,0 -1.5,-2.6 1.5,-2.6" fill="#5555aa" stroke="#aaaacc" stroke-width="0.5"/>
    <circle r="1.8" fill="rgba(180,180,220,0.75)"/>
  </svg>

  <!-- Stardust: 4-point gold sparkle -->
  <svg v-else-if="id === 'stardust'" :width="size ?? 24" :height="size ?? 24" viewBox="-12 -12 24 24" xmlns="http://www.w3.org/2000/svg">
    <polygon points="0,0 -1.5,-6.5 0,-10.5 1.5,-6.5" fill="#ffcc44" opacity="0.9"/>
    <polygon points="0,0 6.5,-1.5 10.5,0 6.5,1.5" fill="#ffcc44" opacity="0.9"/>
    <polygon points="0,0 1.5,6.5 0,10.5 -1.5,6.5" fill="#ffcc44" opacity="0.9"/>
    <polygon points="0,0 -6.5,1.5 -10.5,0 -6.5,-1.5" fill="#ffcc44" opacity="0.9"/>
    <circle r="2.5" fill="white"/>
  </svg>

  <!-- Mana Core: purple diamond gem -->
  <svg v-else-if="id === 'mana_core'" :width="size ?? 24" :height="size ?? 24" viewBox="-11 -11 22 22" xmlns="http://www.w3.org/2000/svg">
    <circle r="10.5" fill="rgba(119,0,204,0.18)"/>
    <polygon points="0,-8 7,0 0,8 -7,0" fill="#9933ff" stroke="#dd88ff" stroke-width="1.2"/>
    <polygon points="0,-4.5 3.5,0 0,4.5 -3.5,0" fill="#cc77ff" opacity="0.6"/>
    <circle r="2" fill="rgba(238,204,255,0.92)"/>
  </svg>

  <!-- Fallback emoji -->
  <span v-else :style="{ fontSize: ((size ?? 24) * 0.7) + 'px', lineHeight: 1, display: 'inline-block' }">❓</span>
</template>
