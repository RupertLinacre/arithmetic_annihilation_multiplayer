export type TeamId = 'solar' | 'lunar'
export type Side = 'left' | 'right'
export type MathsLevel = 'reception' | 'year1' | 'year2' | 'year3' | 'year4' | 'year5' | 'year6'
export type TowerType = 'bolt' | 'spray' | 'missile' | 'cluster'
export type MonsterType = 'scout' | 'runner' | 'brute' | 'titan'

export interface PlayerProfile {
  id: string
  name: string
  mathsLevel: MathsLevel
  teamId: TeamId
  side: Side
  isBot?: boolean
}

export interface TeamState {
  id: TeamId
  side: Side
  baseHealth: number
  maxBaseHealth: number
  comebackBoost: number
  answerStats: {
    correct: number
    wrong: number
  }
}

export interface TowerState {
  id: number
  teamId: TeamId
  type: TowerType
  level: number
  col: number
  row: number
  cooldownMs: number
}

export interface UnitState {
  id: number
  teamId: TeamId
  type: MonsterType
  lane: number
  x: number
  y: number
  vx: number
  vy: number
  health: number
  maxHealth: number
  radius: number
  hurtFlashMs: number
  lastProgressDistance: number
  stalledSeconds: number
  panicSecondsRemaining: number
  panicStartDistance: number
  isStuck: boolean
}

export interface SpawnerState {
  teamId: TeamId
  type: MonsterType
  level: number
  progress: number
  spawnCount: number
}

export type ProjectileType = 'bullet' | 'missile' | 'cluster' | 'fragment'

export interface ProjectileState {
  id: number
  teamId: TeamId
  kind: TowerType
  type: ProjectileType
  visualType?: 'bullet' | 'spray'
  x: number
  y: number
  previousX: number
  previousY: number
  vx: number
  vy: number
  damage: number
  radius: number
  lifeMs: number
  maxLifeMs: number
  targetId?: number
  turnRate?: number
  speed?: number
  homingDelayMs?: number
  trailScale?: number
  explosionRadius?: number
  fragmentCount?: number
  fragmentDamage?: number
}

export interface ExplosionState {
  id: number
  teamId: TeamId
  x: number
  y: number
  radius: number
  lifeMs: number
  maxLifeMs: number
}

export interface GameSnapshot {
  status: 'playing' | 'ended'
  winner?: TeamId
  tick: number
  elapsedMs: number
  teams: Record<TeamId, TeamState>
  players: PlayerProfile[]
  towers: TowerState[]
  units: UnitState[]
  spawners: SpawnerState[]
  projectiles: ProjectileState[]
  explosions: ExplosionState[]
  pendingActions: ScheduledAction[]
  events: string[]
}

export type GameAction =
  | { kind: 'buildTower'; teamId: TeamId; type: TowerType; col: number; row: number }
  | { kind: 'upgradeTower'; teamId: TeamId; towerId: number }
  | { kind: 'upgradeSpawner'; teamId: TeamId; type: MonsterType }
  | { kind: 'recordAnswer'; teamId: TeamId; correct: boolean }
  | { kind: 'wrongAnswer'; teamId: TeamId }
  | { kind: 'deliverMonster'; teamId: TeamId; type: MonsterType; lane: number; level: number }

export interface ScheduledAction {
  id: string
  tick: number
  playerId: string
  action: GameAction
}

export type WireMessage =
  | { kind: 'join'; profile: Pick<PlayerProfile, 'id' | 'name' | 'mathsLevel'> }
  | { kind: 'lobby'; players: PlayerProfile[]; inviteCode: string }
  | { kind: 'start'; snapshot: GameSnapshot }
  | { kind: 'action'; playerId: string; action: GameAction }
  | { kind: 'command'; command: ScheduledAction }
  | { kind: 'checksum'; tick: number; checksum: string }
  | { kind: 'resyncRequest'; tick: number }
  | { kind: 'resync'; snapshot: GameSnapshot }
  | { kind: 'rematch'; snapshot: GameSnapshot }
  | { kind: 'error'; message: string }

export interface MathsQuestion {
  prompt: string
  answer: string
  choices: string[]
  levelLabel: string
  type: string
}
