import type { MonsterType, TeamId, TowerType } from './types'

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`

export const WORLD = {
  width: 2080,
  height: 720,
  mapLeft: 130,
  mapRight: 1950,
  mapTop: 62,
  mapBottom: 674,
  cols: 36,
  rows: 12,
  laneY: [138.5, 240.5, 342.5, 444.5, 546.5],
  leftBaseCol: 1,
  rightBaseCol: 34,
  baseRow: 6,
} as const

export const TEAM_META: Record<TeamId, { name: string; colour: string; sideLabel: string }> = {
  solar: { name: 'Solar Squad', colour: '#ffbd3e', sideLabel: 'Left side' },
  lunar: { name: 'Lunar Squad', colour: '#7ee7ff', sideLabel: 'Right side' },
}

export const TOWER_META: Record<TowerType, {
  name: string
  shortName: string
  sprite: string
  range: number
  damage: number
  cooldownMs: number
  challenge: number
  colour: string
}> = {
  bolt: { name: 'Bolt Tower', shortName: 'Bolt', sprite: assetUrl('sprites/turret_basic.png'), range: 150, damage: 13, cooldownMs: 660, challenge: 0, colour: '#39d7bc' },
  spray: { name: 'Spray Tower', shortName: 'Spray', sprite: assetUrl('sprites/turret_cluster.png'), range: 138, damage: 8, cooldownMs: 1000, challenge: 1, colour: '#ff9f43' },
  missile: { name: 'Missile Tower', shortName: 'Missile', sprite: assetUrl('sprites/turret_sidewinder.png'), range: 180, damage: 24, cooldownMs: 920, challenge: 2, colour: '#9bd9ff' },
  cluster: { name: 'Cluster Tower', shortName: 'Cluster', sprite: assetUrl('sprites/turrent_cluster_bomb.png'), range: 170, damage: 19, cooldownMs: 1600, challenge: 3, colour: '#ff79c8' },
}

export interface TowerLevelStats {
  range: number
  cooldownMs: number
  damage: number
  bulletSpeed?: number
  pelletCount?: number
  spreadRadians?: number
  missileCount?: number
  missileSpeed?: number
  missileTurnRate?: number
  explosionRadius?: number
  fragmentCount?: number
  fragmentDamage?: number
  threat: number
}

/** Exact combat progression from the original single-player balance table. */
export const TOWER_STATS: Record<TowerType, TowerLevelStats[]> = {
  bolt: [
    { range: 150, cooldownMs: 660, damage: 13, bulletSpeed: 420, threat: 3.6 },
    { range: 168, cooldownMs: 330, damage: 13, bulletSpeed: 430, threat: 4.4 },
    { range: 186, cooldownMs: 230, damage: 14, bulletSpeed: 440, threat: 5.2 },
    { range: 205, cooldownMs: 180, damage: 16, bulletSpeed: 450, threat: 6.1 },
    { range: 225, cooldownMs: 150, damage: 18, bulletSpeed: 465, threat: 7.1 },
    { range: 246, cooldownMs: 130, damage: 20, bulletSpeed: 480, threat: 8.2 },
    { range: 268, cooldownMs: 115, damage: 22, bulletSpeed: 495, threat: 9.4 },
    { range: 291, cooldownMs: 105, damage: 24, bulletSpeed: 515, threat: 10.7 },
    { range: 315, cooldownMs: 96, damage: 27, bulletSpeed: 535, threat: 12.1 },
    { range: 340, cooldownMs: 88, damage: 30, bulletSpeed: 555, threat: 13.6 },
    { range: 366, cooldownMs: 82, damage: 33, bulletSpeed: 575, threat: 15.2 },
    { range: 393, cooldownMs: 76, damage: 36, bulletSpeed: 600, threat: 16.9 },
    { range: 421, cooldownMs: 72, damage: 40, bulletSpeed: 625, threat: 18.7 },
    { range: 450, cooldownMs: 68, damage: 44, bulletSpeed: 650, threat: 20.6 },
    { range: 480, cooldownMs: 64, damage: 48, bulletSpeed: 680, threat: 22.6 },
    { range: 512, cooldownMs: 60, damage: 52, bulletSpeed: 710, threat: 24.7 },
  ],
  spray: [
    { range: 138, cooldownMs: 1000, damage: 8, bulletSpeed: 390, pelletCount: 3, spreadRadians: .42, threat: 4 },
    { range: 158, cooldownMs: 670, damage: 8, bulletSpeed: 400, pelletCount: 4, spreadRadians: .48, threat: 4.8 },
    { range: 178, cooldownMs: 600, damage: 9, bulletSpeed: 410, pelletCount: 5, spreadRadians: .54, threat: 5.8 },
    { range: 198, cooldownMs: 550, damage: 10, bulletSpeed: 425, pelletCount: 6, spreadRadians: .6, threat: 6.7 },
    { range: 220, cooldownMs: 500, damage: 10, bulletSpeed: 440, pelletCount: 7, spreadRadians: .66, threat: 7.8 },
    { range: 242, cooldownMs: 460, damage: 10, bulletSpeed: 455, pelletCount: 8, spreadRadians: .72, threat: 9 },
    { range: 266, cooldownMs: 430, damage: 10, bulletSpeed: 475, pelletCount: 9, spreadRadians: .78, threat: 10.3 },
    { range: 290, cooldownMs: 410, damage: 10, bulletSpeed: 495, pelletCount: 10, spreadRadians: .84, threat: 11.7 },
    { range: 316, cooldownMs: 390, damage: 11, bulletSpeed: 515, pelletCount: 11, spreadRadians: .9, threat: 13.2 },
    { range: 342, cooldownMs: 372, damage: 11, bulletSpeed: 535, pelletCount: 12, spreadRadians: .96, threat: 14.8 },
    { range: 370, cooldownMs: 355, damage: 11, bulletSpeed: 560, pelletCount: 13, spreadRadians: 1.02, threat: 16.5 },
    { range: 398, cooldownMs: 338, damage: 12, bulletSpeed: 585, pelletCount: 14, spreadRadians: 1.08, threat: 18.3 },
    { range: 428, cooldownMs: 322, damage: 12, bulletSpeed: 610, pelletCount: 15, spreadRadians: 1.14, threat: 20.2 },
    { range: 458, cooldownMs: 306, damage: 12, bulletSpeed: 640, pelletCount: 16, spreadRadians: 1.2, threat: 22.2 },
    { range: 490, cooldownMs: 292, damage: 13, bulletSpeed: 670, pelletCount: 17, spreadRadians: 1.26, threat: 24.3 },
    { range: 522, cooldownMs: 278, damage: 13, bulletSpeed: 700, pelletCount: 18, spreadRadians: 1.32, threat: 26.5 },
  ],
  missile: [
    { range: 180, cooldownMs: 920, damage: 24, missileCount: 1, missileSpeed: 165, missileTurnRate: 2, threat: 5 },
    { range: 202, cooldownMs: 530, damage: 27, missileCount: 1, missileSpeed: 185, missileTurnRate: 2.25, threat: 6.2 },
    { range: 226, cooldownMs: 650, damage: 28, missileCount: 2, missileSpeed: 205, missileTurnRate: 2.55, threat: 7.5 },
    { range: 252, cooldownMs: 540, damage: 31, missileCount: 2, missileSpeed: 230, missileTurnRate: 2.85, threat: 9 },
    { range: 282, cooldownMs: 650, damage: 32, missileCount: 3, missileSpeed: 255, missileTurnRate: 3.15, threat: 10.7 },
    { range: 314, cooldownMs: 560, damage: 34, missileCount: 3, missileSpeed: 280, missileTurnRate: 3.45, threat: 12.6 },
    { range: 348, cooldownMs: 620, damage: 35, missileCount: 4, missileSpeed: 310, missileTurnRate: 3.8, threat: 14.8 },
    { range: 386, cooldownMs: 550, damage: 37, missileCount: 4, missileSpeed: 340, missileTurnRate: 4.15, threat: 17.2 },
    { range: 424, cooldownMs: 650, damage: 39, missileCount: 5, missileSpeed: 375, missileTurnRate: 4.55, threat: 19.8 },
    { range: 464, cooldownMs: 575, damage: 41, missileCount: 5, missileSpeed: 410, missileTurnRate: 4.95, threat: 22.7 },
    { range: 506, cooldownMs: 675, damage: 42, missileCount: 6, missileSpeed: 445, missileTurnRate: 5.35, threat: 25.8 },
    { range: 550, cooldownMs: 600, damage: 44, missileCount: 6, missileSpeed: 480, missileTurnRate: 5.75, threat: 29.1 },
    { range: 596, cooldownMs: 700, damage: 45, missileCount: 7, missileSpeed: 520, missileTurnRate: 6.2, threat: 32.6 },
    { range: 644, cooldownMs: 625, damage: 47, missileCount: 7, missileSpeed: 560, missileTurnRate: 6.65, threat: 36.3 },
    { range: 694, cooldownMs: 725, damage: 48, missileCount: 8, missileSpeed: 600, missileTurnRate: 7.1, threat: 40.2 },
    { range: 746, cooldownMs: 650, damage: 50, missileCount: 8, missileSpeed: 640, missileTurnRate: 7.55, threat: 44.3 },
  ],
  cluster: [
    { range: 170, cooldownMs: 1600, damage: 19, bulletSpeed: 260, explosionRadius: 54, fragmentCount: 5, fragmentDamage: 6, threat: 5.6 },
    { range: 195, cooldownMs: 1100, damage: 24, bulletSpeed: 275, explosionRadius: 64, fragmentCount: 6, fragmentDamage: 8, threat: 7 },
    { range: 220, cooldownMs: 970, damage: 29, bulletSpeed: 292, explosionRadius: 74, fragmentCount: 8, fragmentDamage: 9, threat: 8.6 },
    { range: 246, cooldownMs: 930, damage: 35, bulletSpeed: 310, explosionRadius: 86, fragmentCount: 9, fragmentDamage: 11, threat: 10.4 },
    { range: 274, cooldownMs: 1050, damage: 42, bulletSpeed: 330, explosionRadius: 98, fragmentCount: 12, fragmentDamage: 13, threat: 12.5 },
    { range: 304, cooldownMs: 1060, damage: 50, bulletSpeed: 352, explosionRadius: 112, fragmentCount: 13, fragmentDamage: 15, threat: 14.9 },
    { range: 336, cooldownMs: 1040, damage: 59, bulletSpeed: 376, explosionRadius: 126, fragmentCount: 14, fragmentDamage: 16, threat: 17.4 },
    { range: 370, cooldownMs: 1100, damage: 69, bulletSpeed: 402, explosionRadius: 142, fragmentCount: 16, fragmentDamage: 18, threat: 20.2 },
    { range: 406, cooldownMs: 1120, damage: 78, bulletSpeed: 430, explosionRadius: 156, fragmentCount: 17, fragmentDamage: 19, threat: 23.1 },
    { range: 444, cooldownMs: 1140, damage: 88, bulletSpeed: 458, explosionRadius: 170, fragmentCount: 18, fragmentDamage: 20, threat: 26.2 },
    { range: 484, cooldownMs: 1160, damage: 99, bulletSpeed: 488, explosionRadius: 184, fragmentCount: 19, fragmentDamage: 21, threat: 29.5 },
    { range: 526, cooldownMs: 1180, damage: 111, bulletSpeed: 520, explosionRadius: 198, fragmentCount: 20, fragmentDamage: 22, threat: 33 },
    { range: 570, cooldownMs: 1200, damage: 124, bulletSpeed: 554, explosionRadius: 214, fragmentCount: 21, fragmentDamage: 24, threat: 36.8 },
    { range: 616, cooldownMs: 1220, damage: 138, bulletSpeed: 590, explosionRadius: 230, fragmentCount: 22, fragmentDamage: 25, threat: 40.8 },
    { range: 664, cooldownMs: 1240, damage: 153, bulletSpeed: 628, explosionRadius: 246, fragmentCount: 23, fragmentDamage: 27, threat: 45.1 },
    { range: 714, cooldownMs: 1260, damage: 169, bulletSpeed: 668, explosionRadius: 264, fragmentCount: 24, fragmentDamage: 29, threat: 49.6 },
  ],
}

export const getTowerStats = (tower: { type: TowerType; level: number }) =>
  TOWER_STATS[tower.type][Math.max(1, Math.min(TOWER_STATS[tower.type].length, tower.level)) - 1]

export const getMaxTowerLevel = (type: TowerType) => TOWER_STATS[type].length

const TOWER_UPGRADE_CHALLENGES: Record<TowerType, number[]> = {
  bolt: [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  spray: [1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  missile: [2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  cluster: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
}

export const getTowerUpgradeChallenge = (type: TowerType, nextLevel: number) => {
  const progression = TOWER_UPGRADE_CHALLENGES[type]
  return progression[Math.max(0, Math.min(progression.length - 1, nextLevel - 2))]
}

export const MONSTER_META: Record<MonsterType, {
  name: string
  description: string
  sprite: string
  health: number
  speed: number
  radius: number
  baseDamage: number
  spawnSeconds: number
  challenge: number
}> = {
  scout: { name: 'Nibble', description: 'Quick & light', sprite: assetUrl('sprites/monster_1_run.png'), health: 34, speed: 88, radius: 10, baseDamage: 2, spawnSeconds: 8, challenge: 0 },
  runner: { name: 'Zapper', description: 'Steady grunt', sprite: assetUrl('sprites/monster_2_run.png'), health: 72, speed: 61, radius: 13, baseDamage: 5, spawnSeconds: 11, challenge: 1 },
  brute: { name: 'Chomper', description: 'Armoured tank', sprite: assetUrl('sprites/monster_3_run.png'), health: 180, speed: 38, radius: 17, baseDamage: 12, spawnSeconds: 15, challenge: 2 },
  // Monster 4 is the original tank's 1.6x-health visual tier.
  titan: { name: 'Mega Moo', description: 'Elite tank', sprite: assetUrl('sprites/monster_4_run.png'), health: 288, speed: 38, radius: 17, baseDamage: 12, spawnSeconds: 22, challenge: 3 },
}

export const TOWER_TYPES = Object.keys(TOWER_META) as TowerType[]
export const MONSTER_TYPES = Object.keys(MONSTER_META) as MonsterType[]

/** Each spawner level produces that many times the level-1 monster rate. */
export const SPAWNER_RATE_MULTIPLIERS = [
  1, 2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14, 15, 16,
] as const

export const MAX_SPAWNER_LEVEL = SPAWNER_RATE_MULTIPLIERS.length
export const MONSTER_HEALTH_INCREASE_PER_SPAWNER_LEVEL = .25

export function getSpawnerRateMultiplier(level: number) {
  const clampedLevel = Math.max(1, Math.min(MAX_SPAWNER_LEVEL, level))
  return SPAWNER_RATE_MULTIPLIERS[clampedLevel - 1]
}

export function getSpawnerSpawnPeriod(type: MonsterType, level: number) {
  return MONSTER_META[type].spawnSeconds / getSpawnerRateMultiplier(level)
}

export function getMonsterHealthAtSpawnerLevel(type: MonsterType, level: number) {
  const clampedLevel = Math.max(1, Math.min(MAX_SPAWNER_LEVEL, level))
  const multiplier = 1 + (clampedLevel - 1) * MONSTER_HEALTH_INCREASE_PER_SPAWNER_LEVEL
  return MONSTER_META[type].health * multiplier
}

export const BALANCE_RULES = {
  // Retained for later opt-in balancing, but disabled so combat is identical to single player.
  enabled: false,
  healthGapBeforeBoost: 0.18,
  maxBoost: 0.14,
  towerDamageWeight: 0.65,
  baseShieldWeight: 0.35,
} as const

export const cellWidth = (WORLD.mapRight - WORLD.mapLeft) / WORLD.cols
export const cellHeight = (WORLD.mapBottom - WORLD.mapTop) / WORLD.rows

export type TerrainType = 'grass' | 'tarmac' | 'tree'

/** A mirrored, deterministic map keeps both halves fair and identical on every peer. */
export function terrainAt(col: number, row: number): TerrainType {
  const mirroredCol = col < WORLD.cols / 2 ? col : WORLD.cols - 1 - col
  const laneRows = [1, 3, 5, 7, 9]
  if (laneRows.includes(row)) return 'tarmac'
  if (mirroredCol < 3 || mirroredCol > WORLD.cols / 2 - 3) return 'grass'
  const hash = Math.abs(((mirroredCol + 11) * 73856093) ^ ((row + 17) * 19349663)) % 100
  if (hash < 17) return 'tree'
  if (hash < 29) return 'tarmac'
  return 'grass'
}

export function cellCentre(col: number, row: number) {
  return {
    x: WORLD.mapLeft + (col + 0.5) * cellWidth,
    y: WORLD.mapTop + (row + 0.5) * cellHeight,
  }
}

export function isCellOnTeamSide(teamId: TeamId, col: number) {
  return teamId === 'solar' ? col < WORLD.cols / 2 : col >= WORLD.cols / 2
}

export function baseCell(teamId: TeamId) {
  return { col: teamId === 'solar' ? WORLD.leftBaseCol : WORLD.rightBaseCol, row: WORLD.baseRow }
}

export function baseCentre(teamId: TeamId) {
  const base = baseCell(teamId)
  return cellCentre(base.col, base.row)
}

export function isBaseFootprintCell(col: number, row: number) {
  return (['solar', 'lunar'] as TeamId[]).some((teamId) => {
    const base = baseCell(teamId)
    return Math.abs(col - base.col) <= 1 && Math.abs(row - base.row) <= 1
  })
}
