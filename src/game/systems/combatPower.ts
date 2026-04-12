export interface CombatPowerInput {
  damageCore: number
  bulletCount: number
  turboFireRatePct: number
  arsenalFireRatePct: number
  damageBonusPct: number
  arsenalDamagePct: number
  missileLaunchers: number
  interstellarMissile: boolean
  playerMaxHp: number
  armorPlatingHpPct: number
  regenPctPerSec: number
  damageTakenReduction: number
  staticField: boolean
  plasmaClearsBullets: boolean
  clusterBomb: boolean
  allyDroneCount: number
  neutronVacuumActive: boolean
  manaCoreActive: boolean
  playerLevel: number
  cardLevelSum: number
  equippedArtifactCount: number
  shipUpgradePointSum: number
  shipPowerFactor: number
  corePowerBonus?: number
}

export function getShipPowerFactor(shipId: string): number {
  if (shipId === 'star_shooter') return 1.26
  if (shipId === 'star_holder') return 1.18
  if (shipId === 'star_faster') return 1.16
  return 1.0
}

export function calculateCombatPower(input: CombatPowerInput): number {
  const spreadBonus = 1 + Math.max(0, input.bulletCount - 1) * 0.36
  const fireRateBonus = 1 + input.turboFireRatePct / 100 + input.arsenalFireRatePct / 100
  const cardDamageBonus = 1 + input.damageBonusPct / 100 + input.arsenalDamagePct / 100
  const missileBonus = 1 + input.missileLaunchers * 0.18 + (input.interstellarMissile ? 0.35 : 0)
  const offensivePower = input.damageCore * spreadBonus * fireRateBonus * cardDamageBonus * missileBonus

  const sustainCore = input.playerMaxHp * (1 + input.armorPlatingHpPct / 100)
  const regenFactor = 1 + input.regenPctPerSec * 0.11
  const mitigationFactor = 1 + input.damageTakenReduction * 1.9
  const sustainPower = sustainCore * regenFactor * mitigationFactor

  const utilityPower =
    (input.staticField ? 190 : 0)
    + (input.plasmaClearsBullets ? 120 : 0)
    + (input.clusterBomb ? 80 : 0)
    + input.allyDroneCount * 55
    + (input.neutronVacuumActive ? 70 : 0)
    + (input.manaCoreActive ? 90 : 0)

  const progressionPower =
    input.playerLevel * 26
    + input.cardLevelSum * 48
    + input.equippedArtifactCount * 70
    + input.shipUpgradePointSum * 36
    + (input.corePowerBonus ?? 0)

  const total =
    (offensivePower * 2.15 + sustainPower * 1.2 + utilityPower + progressionPower)
    * input.shipPowerFactor

  return Math.max(320, Math.round(total))
}
