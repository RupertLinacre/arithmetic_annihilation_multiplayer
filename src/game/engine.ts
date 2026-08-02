import {
  BALANCE_RULES, baseCell, cellCentre, cellHeight, cellWidth, getSpawnerSpawnPeriod, MAX_SPAWNER_LEVEL, getMaxTowerLevel, getTowerStats, isBaseFootprintCell,
  isCellOnTeamSide, MONSTER_META, MONSTER_TYPES, TEAM_META, terrainAt, TOWER_META, WORLD,
} from './config'
import {
  buildFlowField, costAt, hasLineOfSight, isBlocked, raycastCells, sampleDirection, TERRAIN_SPEED, worldToCell,
  type FlowField,
} from './pathfinding'
import type {
  GameAction, GameSnapshot, MonsterType, PlayerProfile, ProjectileState, ScheduledAction,
  SpawnerState, TeamId, TowerState, UnitState,
} from './types'

const clone = <T,>(value: T): T => structuredClone(value)
const FIXED_STEP_MS = 40
const CHECKSUM_INTERVAL_TICKS = 25

function normalize(dx: number, dy: number) {
  const length = Math.hypot(dx, dy) || 1
  return { x: dx / length, y: dy / length }
}

function angleDifference(target: number, current: number) {
  let delta = target - current
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

interface TreeCollision { hitX: number; hitY: number; normalX: number; normalY: number }

function collisionTime(from: { x: number; y: number }, to: { x: number; y: number }, cell: { col: number; row: number }, normalX: number, normalY: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const candidates: number[] = []
  if (normalX !== 0 && dx !== 0) {
    const boundary = normalX < 0 ? WORLD.mapLeft + cell.col * cellWidth : WORLD.mapLeft + (cell.col + 1) * cellWidth
    candidates.push((boundary - from.x) / dx)
  }
  if (normalY !== 0 && dy !== 0) {
    const boundary = normalY < 0 ? WORLD.mapTop + cell.row * cellHeight : WORLD.mapTop + (cell.row + 1) * cellHeight
    candidates.push((boundary - from.y) / dy)
  }
  const valid = candidates.filter(Number.isFinite)
  return valid.length ? Math.max(0, Math.min(1, Math.min(...valid))) : 0
}

function firstTreeCollision(from: { x: number; y: number }, to: { x: number; y: number }): TreeCollision | undefined {
  const cells = raycastCells(from, to)
  const dx = to.x - from.x
  const dy = to.y - from.y
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index]
    if (terrainAt(cell.col, cell.row) !== 'tree') continue
    if (index === 0) {
      const normalX = Math.abs(dx) >= Math.abs(dy) ? -Math.sign(dx) : 0
      const normalY = Math.abs(dy) > Math.abs(dx) ? -Math.sign(dy) : 0
      return { hitX: from.x, hitY: from.y, normalX, normalY }
    }
    const previous = cells[index - 1]
    const normalX = previous.col < cell.col ? -1 : previous.col > cell.col ? 1 : 0
    const normalY = previous.row < cell.row ? -1 : previous.row > cell.row ? 1 : 0
    const time = collisionTime(from, to, cell, normalX, normalY)
    return { hitX: from.x + dx * time, hitY: from.y + dy * time, normalX, normalY }
  }
}

function numberHash(input: string) {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function stableNumber(value: number | undefined) {
  return value === undefined ? '' : Math.round(value * 1000) / 1000
}

export class GameEngine {
  private state: GameSnapshot
  private nextId = 1
  private eventQueue: string[] = []
  private monsterDeliveries: Extract<GameAction, { kind: 'deliverMonster' }>[] = []
  private checksums = new Map<number, string>()
  private flowFields!: Record<TeamId, FlowField>
  private emergencyFlowFields!: Record<TeamId, FlowField>

  constructor(players: PlayerProfile[], restored?: GameSnapshot) {
    if (restored) {
      this.state = clone(restored)
      this.nextId = Math.max(0, ...this.state.towers.map((item) => item.id), ...this.state.units.map((item) => item.id), ...this.state.projectiles.map((item) => item.id), ...this.state.explosions.map((item) => item.id)) + 1
    } else {
      const spawners = (['solar', 'lunar'] as TeamId[]).flatMap((teamId) =>
        MONSTER_TYPES.map((type): SpawnerState => ({ teamId, type, level: 0, progress: 0, spawnCount: 0 })),
      )
      this.state = {
        status: 'playing', tick: 0, elapsedMs: 0,
        teams: {
          solar: { id: 'solar', side: 'left', baseHealth: 100, maxBaseHealth: 100, comebackBoost: 0 },
          lunar: { id: 'lunar', side: 'right', baseHealth: 100, maxBaseHealth: 100, comebackBoost: 0 },
        },
        players, towers: [], units: [], spawners, projectiles: [], explosions: [], pendingActions: [],
        events: ['Battle stations! Build towers and awaken your monster generators.'],
      }
    }
    this.rebuildFlowFields()
    this.rememberChecksum()
  }

  static fromSnapshot(snapshot: GameSnapshot) {
    return new GameEngine(snapshot.players, snapshot)
  }

  snapshot(): GameSnapshot { return clone(this.state) }
  get tick() { return this.state.tick }

  restore(snapshot: GameSnapshot) {
    this.state = clone(snapshot)
    this.monsterDeliveries = []
    this.nextId = Math.max(0, ...this.state.towers.map((item) => item.id), ...this.state.units.map((item) => item.id), ...this.state.projectiles.map((item) => item.id), ...this.state.explosions.map((item) => item.id)) + 1
    this.checksums.clear()
    this.rebuildFlowFields()
    this.rememberChecksum()
  }

  schedule(command: ScheduledAction) {
    if (command.tick <= this.state.tick || this.state.pendingActions.some((item) => item.id === command.id)) return false
    this.state.pendingActions.push(clone(command))
    this.state.pendingActions.sort((a, b) => a.tick - b.tick || a.id.localeCompare(b.id))
    return true
  }

  checksumAt(tick: number) { return this.checksums.get(tick) }
  latestChecksum() { return { tick: this.state.tick, checksum: this.makeChecksum() } }
  drainMonsterDeliveries() { return this.monsterDeliveries.splice(0) }

  /** Immediate application is reserved for local practice mode and test setup. */
  apply(action: GameAction): boolean { return this.applyAction(action) }

  step(dtMs = FIXED_STEP_MS) {
    if (this.state.status !== 'playing') return
    const bounded = Math.min(dtMs, 80)
    this.state.tick += 1
    this.state.elapsedMs = this.state.tick * bounded
    const due = this.state.pendingActions.filter((command) => command.tick <= this.state.tick)
    this.state.pendingActions = this.state.pendingActions.filter((command) => command.tick > this.state.tick)
    for (const command of due) this.applyAction(command.action)
    const dt = bounded / 1000
    this.updateBalance()
    this.updateSpawners(dt)
    this.updateUnits(dt)
    this.updateTowers(bounded)
    this.updateProjectiles(bounded)
    for (const explosion of this.state.explosions) explosion.lifeMs -= bounded
    this.state.explosions = this.state.explosions.filter((explosion) => explosion.lifeMs > 0)
    this.state.units = this.state.units.filter((unit) => unit.health > 0)
    if (this.eventQueue.length) {
      this.state.events = [...this.eventQueue, ...this.state.events].slice(0, 4)
      this.eventQueue = []
    }
    if (this.state.tick % CHECKSUM_INTERVAL_TICKS === 0) this.rememberChecksum()
  }

  private applyAction(action: GameAction) {
    if (this.state.status !== 'playing') return false
    if (action.kind === 'buildTower') return this.buildTower(action)
    if (action.kind === 'upgradeTower') return this.upgradeTower(action.teamId, action.towerId)
    if (action.kind === 'upgradeSpawner') return this.upgradeSpawner(action.teamId, action.type)
    return this.spawnUnit(action.teamId, action.type, action.lane)
  }

  private buildTower(action: Extract<GameAction, { kind: 'buildTower' }>) {
    if (!isCellOnTeamSide(action.teamId, action.col)) return false
    if (action.col < 0 || action.col >= WORLD.cols || action.row < 0 || action.row >= WORLD.rows) return false
    if (terrainAt(action.col, action.row) === 'tree' || isBaseFootprintCell(action.col, action.row)) return false
    if (this.state.towers.some((tower) => tower.col === action.col && tower.row === action.row)) return false
    const tower: TowerState = { id: this.nextId++, teamId: action.teamId, type: action.type, level: 1, col: action.col, row: action.row, cooldownMs: 0 }
    this.state.towers.push(tower)
    this.rebuildFlowFields()
    this.addEvent(`${TEAM_META[action.teamId].name} built a ${TOWER_META[action.type].name}.`)
    return true
  }

  private upgradeTower(teamId: TeamId, towerId: number) {
    const tower = this.state.towers.find((candidate) => candidate.id === towerId && candidate.teamId === teamId)
    if (!tower || tower.level >= getMaxTowerLevel(tower.type)) return false
    tower.level += 1
    tower.cooldownMs = Math.min(tower.cooldownMs, getTowerStats(tower).cooldownMs * .5)
    this.rebuildFlowFields()
    this.addEvent(`${TOWER_META[tower.type].name} reached level ${tower.level}.`)
    return true
  }

  private upgradeSpawner(teamId: TeamId, type: MonsterType) {
    const spawner = this.state.spawners.find((candidate) => candidate.teamId === teamId && candidate.type === type)
    if (!spawner || spawner.level >= MAX_SPAWNER_LEVEL) return false
    spawner.level += 1
    if (spawner.level === 1) spawner.progress = .72
    this.addEvent(`${TEAM_META[teamId].name} powered up ${MONSTER_META[type].name} production.`)
    return true
  }

  private updateSpawners(dt: number) {
    for (const spawner of this.state.spawners) {
      if (spawner.level === 0) continue
      const period = getSpawnerSpawnPeriod(spawner.type, spawner.level)
      spawner.progress += dt / period
      if (spawner.progress < 1) continue
      spawner.progress %= 1
      const typeOffset = MONSTER_TYPES.indexOf(spawner.type)
      const lane = (spawner.spawnCount + typeOffset) % WORLD.laneY.length
      spawner.spawnCount += 1
      this.monsterDeliveries.push({ kind: 'deliverMonster', teamId: spawner.teamId, type: spawner.type, lane })
    }
  }

  private spawnUnit(teamId: TeamId, type: MonsterType, lane: number) {
    if (lane < 0 || lane >= WORLD.laneY.length) return false
    const meta = MONSTER_META[type]
    const row = [1, 3, 5, 7, 9][lane]
    const point = cellCentre(teamId === 'solar' ? 0 : WORLD.cols - 1, row)
    this.state.units.push({
      id: this.nextId++, teamId, type, lane, x: point.x, y: point.y, vx: 0, vy: 0,
      health: meta.health, maxHealth: meta.health, radius: meta.radius, hurtFlashMs: 0, lastProgressDistance: Number.POSITIVE_INFINITY,
      stalledSeconds: 0, panicSecondsRemaining: 0, panicStartDistance: Number.POSITIVE_INFINITY, isStuck: false,
    })
    return true
  }

  private updateUnits(dt: number) {
    for (const unit of this.state.units) {
      unit.hurtFlashMs = Math.max(0, unit.hurtFlashMs - dt * 1000)
      const activeField = unit.isStuck ? this.emergencyFlowFields[unit.teamId] : this.flowFields[unit.teamId]
      const desired = sampleDirection(activeField, unit)
      const cell = worldToCell(unit)
      const speed = MONSTER_META[unit.type].speed * (cell ? TERRAIN_SPEED[terrainAt(cell.col, cell.row)] : 1)
      unit.vx += (desired.x * speed - unit.vx) * Math.min(1, dt * 4.2)
      unit.vy += (desired.y * speed - unit.vy) * Math.min(1, dt * 4.2)
      let separationX = 0
      let separationY = 0
      for (const other of this.state.units) {
        if (other.id === unit.id || other.teamId !== unit.teamId || other.health <= 0) continue
        const dx = unit.x - other.x
        const dy = unit.y - other.y
        const distance = Math.hypot(dx, dy)
        const minimum = (unit.radius + other.radius) * 1.04
        if (distance > .001 && distance < minimum) {
          const push = (minimum - distance) / minimum
          separationX += dx / distance * push * MONSTER_META[unit.type].speed * .56
          separationY += dy / distance * push * MONSTER_META[unit.type].speed * .56
        }
      }
      const previousX = unit.x
      const previousY = unit.y
      unit.x += (unit.vx + separationX) * dt
      unit.y += (unit.vy + separationY) * dt
      const nextCell = worldToCell(unit)
      if (!nextCell || isBlocked(nextCell.col, nextCell.row)) {
        unit.x = previousX; unit.y = previousY; unit.vx *= -.18; unit.vy *= -.18
      }
      this.updateStuckState(unit, dt)
      const targetTeam: TeamId = unit.teamId === 'solar' ? 'lunar' : 'solar'
      const arrived = worldToCell(unit)
      const targetBase = baseCell(targetTeam)
      if (!arrived || Math.abs(arrived.col - targetBase.col) > 1 || Math.abs(arrived.row - targetBase.row) > 1) continue
      const shield = 1 - this.state.teams[targetTeam].comebackBoost * BALANCE_RULES.baseShieldWeight
      this.state.teams[targetTeam].baseHealth = Math.max(0, this.state.teams[targetTeam].baseHealth - MONSTER_META[unit.type].baseDamage * shield)
      unit.health = 0
      this.addEvent(`${MONSTER_META[unit.type].name} hit ${TEAM_META[targetTeam].name}'s base!`)
      if (this.state.teams[targetTeam].baseHealth <= 0) {
        this.state.status = 'ended'; this.state.winner = unit.teamId
        this.addEvent(`${TEAM_META[unit.teamId].name} wins the battle!`)
      }
    }
  }

  private updateStuckState(unit: UnitState, dt: number) {
    const targetTeam: TeamId = unit.teamId === 'solar' ? 'lunar' : 'solar'
    const target = baseCell(targetTeam)
    let distance = Number.POSITIVE_INFINITY
    for (let row = target.row - 1; row <= target.row + 1; row += 1) {
      for (let col = target.col - 1; col <= target.col + 1; col += 1) {
        const center = cellCentre(col, row)
        distance = Math.min(distance, Math.hypot(center.x - unit.x, center.y - unit.y))
      }
    }
    if (unit.isStuck) {
      unit.panicSecondsRemaining = Math.max(0, unit.panicSecondsRemaining - dt)
      if (unit.panicSecondsRemaining <= 0 && distance < unit.panicStartDistance - 8) {
        unit.isStuck = false; unit.lastProgressDistance = distance; unit.stalledSeconds = 0
      }
      return
    }
    if (!Number.isFinite(unit.lastProgressDistance) || distance < unit.lastProgressDistance - 8) {
      unit.lastProgressDistance = distance; unit.stalledSeconds = 0; return
    }
    unit.stalledSeconds += dt
    if (unit.stalledSeconds >= 2.5) {
      unit.isStuck = true; unit.panicSecondsRemaining = 3.25; unit.panicStartDistance = distance; unit.stalledSeconds = 0
    }
  }

  private updateTowers(dtMs: number) {
    for (const tower of this.state.towers) {
      tower.cooldownMs -= dtMs
      if (tower.cooldownMs > 0) continue
      const stats = getTowerStats(tower)
      const origin = cellCentre(tower.col, tower.row)
      const targets = this.state.units.filter((unit) => unit.teamId !== tower.teamId && unit.health > 0)
      let target: UnitState | undefined
      let bestCost = Number.POSITIVE_INFINITY
      let bestDistance = Number.POSITIVE_INFINITY
      for (const unit of targets) {
        const distance = Math.hypot(unit.x - origin.x, unit.y - origin.y)
        if (distance > stats.range || !hasLineOfSight(origin, unit)) continue
        const progress = costAt(this.flowFields[unit.teamId], unit)
        if (progress < bestCost || (progress === bestCost && distance < bestDistance)) { target = unit; bestCost = progress; bestDistance = distance }
      }
      if (!target) continue
      const direction = normalize(target.x - origin.x, target.y - origin.y)
      const boost = 1 + this.state.teams[tower.teamId].comebackBoost * BALANCE_RULES.towerDamageWeight
      if (tower.type === 'bolt') {
        const speed = stats.bulletSpeed ?? 420
        this.createProjectile(tower, 'bullet', origin, direction.x * speed, direction.y * speed, stats.damage * boost, 4, 1600)
      } else if (tower.type === 'spray') {
        const count = stats.pelletCount ?? 3
        const spread = stats.spreadRadians ?? .42
        const speed = stats.bulletSpeed ?? 390
        const baseAngle = Math.atan2(direction.y, direction.x)
        for (let index = 0; index < count; index += 1) {
          const t = count === 1 ? .5 : index / (count - 1)
          const angle = baseAngle + (t - .5) * spread
          const projectile = this.createProjectile(tower, 'bullet', origin, Math.cos(angle) * speed, Math.sin(angle) * speed, stats.damage * boost, 3.4, 1250)
          projectile.visualType = 'spray'
        }
      } else if (tower.type === 'missile') {
        const count = stats.missileCount ?? 1
        const speed = stats.missileSpeed ?? 180
        const baseAngle = Math.atan2(direction.y, direction.x)
        const spread = count > 1 ? .2 : 0
        for (let index = 0; index < count; index += 1) {
          const angle = baseAngle + (index - (count - 1) / 2) * spread
          const projectile = this.createProjectile(tower, 'missile', origin, Math.cos(angle) * speed * .55, Math.sin(angle) * speed * .55, stats.damage * boost, 6, 3600)
          projectile.targetId = target.id; projectile.speed = speed; projectile.turnRate = stats.missileTurnRate ?? 2.3
          projectile.homingDelayMs = count > 1 ? 160 : 0
          projectile.trailScale = 1 + (tower.level - 1) / Math.max(1, getMaxTowerLevel('missile') - 1)
        }
      } else {
        const speed = stats.bulletSpeed ?? 280
        const projectile = this.createProjectile(tower, 'cluster', origin, direction.x * speed, direction.y * speed, stats.damage * boost, 8, 2100)
        projectile.targetId = target.id; projectile.explosionRadius = stats.explosionRadius
        projectile.fragmentCount = stats.fragmentCount; projectile.fragmentDamage = (stats.fragmentDamage ?? 7) * boost
      }
      tower.cooldownMs = stats.cooldownMs
    }
  }

  private createProjectile(tower: TowerState, type: ProjectileState['type'], origin: { x: number; y: number }, vx: number, vy: number, damage: number, radius: number, lifeMs: number) {
    const projectile: ProjectileState = {
      id: this.nextId++, teamId: tower.teamId, kind: tower.type, type, x: origin.x, y: origin.y,
      previousX: origin.x, previousY: origin.y, vx, vy, damage, radius, lifeMs, maxLifeMs: lifeMs,
    }
    this.state.projectiles.push(projectile)
    return projectile
  }

  private updateProjectiles(dtMs: number) {
    const alive: ProjectileState[] = []
    const spawned: ProjectileState[] = []
    for (const projectile of this.state.projectiles) {
      projectile.lifeMs -= dtMs
      projectile.previousX = projectile.x; projectile.previousY = projectile.y
      if (projectile.type === 'missile') {
        if ((projectile.homingDelayMs ?? 0) > 0) projectile.homingDelayMs = Math.max(0, (projectile.homingDelayMs ?? 0) - dtMs)
        else this.updateMissileVelocity(projectile, dtMs)
      }
      projectile.x += projectile.vx * dtMs / 1000
      projectile.y += projectile.vy * dtMs / 1000
      if (projectile.lifeMs <= 0) continue
      const tree = firstTreeCollision({ x: projectile.previousX, y: projectile.previousY }, projectile)
      if (tree) {
        if (projectile.type !== 'bullet' && projectile.type !== 'fragment') continue
        if (tree.normalX !== 0) projectile.vx *= -1
        if (tree.normalY !== 0) projectile.vy *= -1
        projectile.x = tree.hitX + tree.normalX * .5
        projectile.y = tree.hitY + tree.normalY * .5
      }
      const hit = this.state.units.find((unit) => unit.teamId !== projectile.teamId && unit.health > 0 && Math.hypot(unit.x - projectile.x, unit.y - projectile.y) <= unit.radius + projectile.radius)
      if (hit) {
        if (projectile.type === 'cluster') this.explodeCluster(projectile, spawned)
        else this.damageUnit(hit, projectile.damage)
        continue
      }
      alive.push(projectile)
    }
    this.state.projectiles = [...alive, ...spawned]
  }

  private updateMissileVelocity(projectile: ProjectileState, dtMs: number) {
    let target = this.state.units.find((unit) => unit.id === projectile.targetId && unit.health > 0)
    if (!target) {
      target = this.state.units.filter((unit) => unit.teamId !== projectile.teamId && unit.health > 0)
        .sort((a, b) => Math.hypot(a.x - projectile.x, a.y - projectile.y) - Math.hypot(b.x - projectile.x, b.y - projectile.y))[0]
      projectile.targetId = target?.id
    }
    if (!target) return
    const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x)
    const current = Math.atan2(projectile.vy, projectile.vx)
    const maxTurn = (projectile.turnRate ?? 2.2) * dtMs / 1000
    const angle = current + Math.max(-maxTurn, Math.min(maxTurn, angleDifference(desired, current)))
    const speed = projectile.speed ?? Math.hypot(projectile.vx, projectile.vy)
    projectile.vx = Math.cos(angle) * speed; projectile.vy = Math.sin(angle) * speed
  }

  private explodeCluster(projectile: ProjectileState, spawned: ProjectileState[]) {
    const radius = projectile.explosionRadius ?? 64
    for (const unit of this.state.units) {
      if (unit.teamId === projectile.teamId || unit.health <= 0) continue
      const distance = Math.hypot(unit.x - projectile.x, unit.y - projectile.y)
      if (distance <= radius) this.damageUnit(unit, projectile.damage * (1 - distance / radius * .45))
    }
    this.state.explosions.push({ id: this.nextId++, teamId: projectile.teamId, x: projectile.x, y: projectile.y, radius, lifeMs: 260, maxLifeMs: 260 })
    const count = projectile.fragmentCount ?? 6
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * 2 * index / count
      spawned.push({
        id: this.nextId++, teamId: projectile.teamId, kind: projectile.kind, type: 'fragment', x: projectile.x, y: projectile.y,
        previousX: projectile.x, previousY: projectile.y, vx: Math.cos(angle) * 260, vy: Math.sin(angle) * 260,
        damage: projectile.fragmentDamage ?? 7, radius: 3.2, lifeMs: 620, maxLifeMs: 620,
      })
    }
  }

  private damageUnit(unit: UnitState, damage: number) {
    unit.health -= damage
    unit.hurtFlashMs = 120
  }

  private rebuildFlowFields() {
    this.flowFields = {
      solar: buildFlowField('solar', this.state.towers),
      lunar: buildFlowField('lunar', this.state.towers),
    }
    this.emergencyFlowFields = {
      solar: buildFlowField('solar', this.state.towers, true),
      lunar: buildFlowField('lunar', this.state.towers, true),
    }
  }

  private updateBalance() {
    if (!BALANCE_RULES.enabled) {
      this.state.teams.solar.comebackBoost = 0
      this.state.teams.lunar.comebackBoost = 0
      return
    }
    const solarRatio = this.state.teams.solar.baseHealth / this.state.teams.solar.maxBaseHealth
    const lunarRatio = this.state.teams.lunar.baseHealth / this.state.teams.lunar.maxBaseHealth
    const gap = Math.abs(solarRatio - lunarRatio)
    const boost = gap <= BALANCE_RULES.healthGapBeforeBoost ? 0 : Math.min(BALANCE_RULES.maxBoost, (gap - BALANCE_RULES.healthGapBeforeBoost) * .45)
    this.state.teams.solar.comebackBoost = solarRatio < lunarRatio ? boost : 0
    this.state.teams.lunar.comebackBoost = lunarRatio < solarRatio ? boost : 0
  }

  private makeChecksum() {
    const data = {
      tick: this.state.tick, status: this.state.status, winner: this.state.winner,
      teams: Object.values(this.state.teams).map((team) => [team.id, stableNumber(team.baseHealth), stableNumber(team.comebackBoost)]),
      towers: this.state.towers.map((tower) => [tower.id, tower.teamId, tower.type, tower.level, tower.col, tower.row, stableNumber(tower.cooldownMs)]),
      units: this.state.units.map((unit) => [unit.id, unit.teamId, unit.type, stableNumber(unit.x), stableNumber(unit.y), stableNumber(unit.vx), stableNumber(unit.vy), stableNumber(unit.health), unit.isStuck]),
      spawners: this.state.spawners.map((spawner) => [spawner.teamId, spawner.type, spawner.level, stableNumber(spawner.progress), spawner.spawnCount]),
      projectiles: this.state.projectiles.map((projectile) => [projectile.id, projectile.teamId, projectile.type, stableNumber(projectile.x), stableNumber(projectile.y), stableNumber(projectile.vx), stableNumber(projectile.vy), stableNumber(projectile.lifeMs)]),
      pending: this.state.pendingActions,
    }
    return numberHash(JSON.stringify(data))
  }

  private rememberChecksum() {
    this.checksums.set(this.state.tick, this.makeChecksum())
    for (const tick of this.checksums.keys()) if (tick < this.state.tick - 250) this.checksums.delete(tick)
  }

  private addEvent(message: string) { this.eventQueue.unshift(message) }
}
