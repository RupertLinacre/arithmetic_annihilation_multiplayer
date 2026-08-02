import { describe, expect, it } from 'vitest'
import { baseCell, isBaseFootprintCell } from './config'
import { GameEngine } from './engine'
import type { PlayerProfile, ScheduledAction } from './types'

const players: PlayerProfile[] = [
  { id: 'one', name: 'One', mathsLevel: 'year2', teamId: 'solar', side: 'left' },
  { id: 'two', name: 'Two', mathsLevel: 'reception', teamId: 'lunar', side: 'right' },
]

function stepPractice(engine: GameEngine, dtMs: number) {
  engine.step(dtMs)
  engine.drainMonsterDeliveries().forEach((delivery) => engine.apply(delivery))
}

describe('GameEngine', () => {
  it('keeps each team on its own build half', () => {
    const engine = new GameEngine(players)
    expect(engine.apply({ kind: 'buildTower', teamId: 'solar', type: 'bolt', col: 3, row: 2 })).toBe(true)
    expect(engine.apply({ kind: 'buildTower', teamId: 'solar', type: 'bolt', col: 25, row: 2 })).toBe(false)
    expect(engine.apply({ kind: 'buildTower', teamId: 'lunar', type: 'bolt', col: 25, row: 1 })).toBe(true)
  })

  it('unlocks a generator and automatically spawns its monster', () => {
    const engine = new GameEngine(players)
    expect(engine.apply({ kind: 'upgradeSpawner', teamId: 'solar', type: 'scout' })).toBe(true)
    for (let step = 0; step < 40; step += 1) stepPractice(engine, 80)
    const state = engine.snapshot()
    expect(state.units.some((unit) => unit.teamId === 'solar' && unit.type === 'scout')).toBe(true)
  })

  it('uses sixteen levels for towers and monster generators', () => {
    const engine = new GameEngine(players)
    engine.apply({ kind: 'buildTower', teamId: 'solar', type: 'spray', col: 4, row: 3 })
    const towerId = engine.snapshot().towers[0].id
    for (let level = 0; level < 20; level += 1) {
      engine.apply({ kind: 'upgradeTower', teamId: 'solar', towerId })
      engine.apply({ kind: 'upgradeSpawner', teamId: 'solar', type: 'brute' })
    }
    const state = engine.snapshot()
    expect(state.towers[0].level).toBe(16)
    expect(state.spawners.find((spawner) => spawner.teamId === 'solar' && spawner.type === 'brute')?.level).toBe(16)
  })

  it('keeps each three-by-three base footprint inside and unbuildable', () => {
    const engine = new GameEngine(players)
    for (const teamId of ['solar', 'lunar'] as const) {
      const base = baseCell(teamId)
      expect(base.col).toBeGreaterThan(0)
      expect(base.col).toBeLessThan(35)
      expect(isBaseFootprintCell(base.col, base.row)).toBe(true)
      expect(engine.apply({ kind: 'buildTower', teamId, type: 'bolt', col: base.col, row: base.row })).toBe(false)
    }
  })

  it('runs matching scheduled command streams deterministically', () => {
    const first = new GameEngine(players)
    const second = new GameEngine(players)
    const commands: ScheduledAction[] = [
      { id: '1-a', tick: 4, playerId: 'one', action: { kind: 'upgradeSpawner', teamId: 'solar', type: 'scout' } },
      { id: '1-b', tick: 7, playerId: 'two', action: { kind: 'buildTower', teamId: 'lunar', type: 'spray', col: 25, row: 5 } },
    ]
    commands.forEach((command) => { first.schedule(command); second.schedule(command) })
    for (let tick = 0; tick < 50; tick += 1) { first.step(40); second.step(40) }
    expect(first.checksumAt(50)).toBe(second.checksumAt(50))
    expect(first.snapshot()).toEqual(second.snapshot())
  })

  it('uses the flow field to steer monsters vertically toward the opposing base', () => {
    const engine = new GameEngine(players)
    engine.apply({ kind: 'upgradeSpawner', teamId: 'solar', type: 'scout' })
    for (let step = 0; step < 70; step += 1) stepPractice(engine, 80)
    const unit = engine.snapshot().units.find((candidate) => candidate.teamId === 'solar')
    expect(unit).toBeDefined()
    expect(Math.abs(unit!.vy)).toBeGreaterThan(.01)
  })

  it('creates the original multi-pellet spray volley as simulated projectiles', () => {
    const engine = new GameEngine(players)
    engine.apply({ kind: 'upgradeSpawner', teamId: 'solar', type: 'scout' })
    engine.apply({ kind: 'buildTower', teamId: 'lunar', type: 'spray', col: 31, row: 5 })
    let sawVolley = false
    for (let step = 0; step < 450 && !sawVolley; step += 1) {
      stepPractice(engine, 80)
      sawVolley = engine.snapshot().projectiles.filter((projectile) => projectile.visualType === 'spray').length >= 3
    }
    expect(sawVolley).toBe(true)
  })
})
