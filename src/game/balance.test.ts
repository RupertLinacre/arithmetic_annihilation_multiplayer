import { describe, expect, it } from 'vitest'
import { BALANCE_RULES, getMaxTowerLevel, getSpawnerRateMultiplier, getSpawnerSpawnPeriod, getTowerStats, getTowerUpgradeChallenge, MAX_SPAWNER_LEVEL, MONSTER_META, SPAWNER_RATE_MULTIPLIERS, TOWER_STATS } from './config'

describe('single-player combat balance', () => {
  it('uses the original monster archetype values', () => {
    expect(MONSTER_META.scout).toMatchObject({ health: 34, speed: 88, radius: 10, baseDamage: 2 })
    expect(MONSTER_META.runner).toMatchObject({ health: 72, speed: 61, radius: 13, baseDamage: 5 })
    expect(MONSTER_META.brute).toMatchObject({ health: 180, speed: 38, radius: 17, baseDamage: 12 })
    expect(MONSTER_META.titan).toMatchObject({ health: 288, speed: 38, radius: 17, baseDamage: 12 })
  })

  it('includes all sixteen original levels for every combat tower', () => {
    expect(Object.values(TOWER_STATS).map((levels) => levels.length)).toEqual([16, 16, 16, 16])
    expect(getMaxTowerLevel('bolt')).toBe(16)
    expect(getTowerStats({ type: 'bolt', level: 16 })).toEqual({ range: 512, cooldownMs: 60, damage: 52, bulletSpeed: 710, threat: 24.7 })
    expect(getTowerStats({ type: 'spray', level: 16 })).toMatchObject({ range: 522, cooldownMs: 278, damage: 13, pelletCount: 18 })
    expect(getTowerStats({ type: 'missile', level: 16 })).toMatchObject({ range: 746, cooldownMs: 650, damage: 50, missileCount: 8 })
    expect(getTowerStats({ type: 'cluster', level: 16 })).toMatchObject({ range: 714, cooldownMs: 1260, damage: 169, fragmentCount: 24, fragmentDamage: 29 })
  })

  it('accelerates monster production through sixteen levels', () => {
    expect(MAX_SPAWNER_LEVEL).toBe(16)
    expect(SPAWNER_RATE_MULTIPLIERS.slice(0, 2)).toEqual([1, 1.34])
    expect(getSpawnerRateMultiplier(3)).toBeGreaterThan(1.68)
    expect(getSpawnerRateMultiplier(4)).toBeGreaterThan(2.02)
    expect(getSpawnerRateMultiplier(5)).toBeGreaterThan(2.36)
    expect(getSpawnerRateMultiplier(16)).toBe(10)
    expect(getSpawnerSpawnPeriod('scout', 1)).toBe(8)
    expect(getSpawnerSpawnPeriod('scout', 2)).toBeCloseTo(8 / 1.34)
    expect(getSpawnerSpawnPeriod('scout', 16)).toBeCloseTo(.8)
  })

  it('matches the original maths progression for tower upgrades', () => {
    expect([2, 3, 4, 5, 6, 7, 8].map((level) => getTowerUpgradeChallenge('bolt', level))).toEqual([0, 0, 1, 1, 2, 2, 3])
    expect([2, 3, 4, 5, 6, 7].map((level) => getTowerUpgradeChallenge('spray', level))).toEqual([1, 1, 2, 2, 2, 3])
    expect([2, 3, 4, 5].map((level) => getTowerUpgradeChallenge('missile', level))).toEqual([2, 2, 2, 3])
    expect(getTowerUpgradeChallenge('cluster', 2)).toBe(3)
  })

  it('keeps experimental comeback modifiers disabled by default', () => {
    expect(BALANCE_RULES.enabled).toBe(false)
  })
})
