import { useEffect, useMemo, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import { GameCanvas } from './components/GameCanvas'
import { MathsQuestionPanel } from './components/MathsModal'
import { GameEngine } from './game/engine'
import { DEFAULT_MATHS_LEVEL, MATHS_LEVELS, MathsQuestionGenerator } from './game/maths'
import { getMaxTowerLevel, getTowerUpgradeChallenge, isBaseFootprintCell, MAX_SPAWNER_LEVEL, MONSTER_META, MONSTER_TYPES, TEAM_META, terrainAt, TOWER_META, TOWER_TYPES, WORLD } from './game/config'
import type { GameAction, GameSnapshot, MathsLevel, MathsQuestion, MonsterType, PlayerProfile, ScheduledAction, TeamId, TowerType, WireMessage } from './game/types'
import './styles.css'

type Phase = 'home' | 'lobby' | 'game'
type Role = 'host' | 'guest' | 'practice'

interface PendingQuestion {
  title: string
  question: MathsQuestion
  action: GameAction
}

const id = () => crypto.randomUUID()
const createInviteCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
const emptySnapshot = (): GameSnapshot => new GameEngine([]).snapshot()

function formatTime(ms: number) {
  const total = Math.floor(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function App() {
  const [localId] = useState(() => id())
  const [mathsGenerator] = useState(() => new MathsQuestionGenerator(localId))
  const peerRef = useRef<Peer | null>(null)
  const connectionRef = useRef<DataConnection | null>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const playersRef = useRef<PlayerProfile[]>([])
  const commandSequenceRef = useRef(1)
  const pendingChecksumsRef = useRef(new Map<number, string>())
  const [phase, setPhase] = useState<Phase>('home')
  const [role, setRole] = useState<Role>('host')
  const [name, setName] = useState(() => localStorage.getItem('aa-player-name') || 'Commander')
  const [mathsLevel, setMathsLevel] = useState<MathsLevel>(() => (localStorage.getItem('aa-maths-level-v2') as MathsLevel) || DEFAULT_MATHS_LEVEL)
  const [joinCode, setJoinCode] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [players, setPlayers] = useState<PlayerProfile[]>([])
  const [connectionStatus, setConnectionStatus] = useState('Ready')
  const [snapshot, setSnapshot] = useState<GameSnapshot>(emptySnapshot)
  const [localTeamId, setLocalTeamId] = useState<TeamId>('solar')
  const [selectedTower, setSelectedTower] = useState<TowerType>('bolt')
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null)
  const [notice, setNotice] = useState('')

  const localPlayer = useMemo(() => players.find((player) => player.id === localId), [players, localId])

  function scheduleAuthoritativeAction(playerId: string, action: GameAction, delayTicks = 12) {
    const engine = engineRef.current
    if (!engine) return
    const command: ScheduledAction = {
      id: `${engine.tick.toString(36)}-${(commandSequenceRef.current++).toString(36)}`,
      tick: engine.tick + delayTicks,
      playerId,
      action,
    }
    if (!engine.schedule(command)) return
    connectionRef.current?.send({ kind: 'command', command } satisfies WireMessage)
  }

  useEffect(() => () => {
    connectionRef.current?.close()
    peerRef.current?.destroy()
  }, [])

  useEffect(() => {
    if (phase !== 'game' || !engineRef.current) return
    let last = performance.now()
    let accumulator = 0
    let lastUiUpdate = 0
    let lastChecksumTick = -1
    let nextBotMove = performance.now() + 4000
    const timer = window.setInterval(() => {
      const now = performance.now()
      const engine = engineRef.current!
      accumulator += Math.min(2000, now - last)
      last = now
      while (accumulator >= 40) {
        engine.step(40)
        accumulator -= 40
      }
      const deliveries = engine.drainMonsterDeliveries()
      if (role === 'host') deliveries.forEach((action) => scheduleAuthoritativeAction('system', action, 4))
      else if (role === 'practice') deliveries.forEach((action) => engine.apply(action))
      if (role === 'practice' && now >= nextBotMove) {
        const latest = engine.snapshot()
        if (latest.status === 'playing') runBotMove(engine, latest)
        nextBotMove += 4300
      }
      if (now - lastUiUpdate > 100) {
        const next = engine.snapshot()
        setSnapshot(next)
        lastUiUpdate = now
      }
      if (role === 'guest') {
        for (const [tick, expected] of pendingChecksumsRef.current) {
          if (tick > engine.tick) continue
          const actual = engine.checksumAt(tick)
          pendingChecksumsRef.current.delete(tick)
          if (actual && actual !== expected) connectionRef.current?.send({ kind: 'resyncRequest', tick } satisfies WireMessage)
        }
      }
      if (role === 'host' && engine.tick > 0 && engine.tick % 50 === 0 && engine.tick !== lastChecksumTick && connectionRef.current?.open) {
        const checkpoint = engine.latestChecksum()
        connectionRef.current.send({ kind: 'checksum', ...checkpoint } satisfies WireMessage)
        lastChecksumTick = engine.tick
      }
    }, 32)
    return () => window.clearInterval(timer)
  }, [phase, role])

  const savePreferences = () => {
    const safeName = name.trim().slice(0, 18) || 'Commander'
    localStorage.setItem('aa-player-name', safeName)
    localStorage.setItem('aa-maths-level-v2', mathsLevel)
    return safeName
  }

  const createMatch = () => {
    closeNetwork()
    const safeName = savePreferences()
    const code = createInviteCode()
    const hostProfile: PlayerProfile = { id: localId, name: safeName, mathsLevel, teamId: 'solar', side: 'left' }
    const peer = new Peer(`aa-${code.toLowerCase()}`, { debug: 1 })
    peerRef.current = peer
    playersRef.current = [hostProfile]
    setPlayers([hostProfile])
    setInviteCode(code)
    setRole('host')
    setPhase('lobby')
    setConnectionStatus('Opening secure peer lobby…')

    peer.on('open', () => setConnectionStatus('Invite ready — waiting for player 2'))
    peer.on('connection', (connection) => {
      if (connectionRef.current?.open) {
        connection.send({ kind: 'error', message: 'This match already has two players.' } satisfies WireMessage)
        connection.close()
        return
      }
      connectionRef.current = connection
      setConnectionStatus('Player 2 is joining…')
      connection.on('data', (data) => handleHostMessage(data as WireMessage, hostProfile, connection, code))
      connection.on('close', () => setConnectionStatus('Player 2 disconnected'))
    })
    peer.on('error', () => setConnectionStatus('Could not open that lobby. Try creating another.'))
  }

  const handleHostMessage = (message: WireMessage, hostProfile: PlayerProfile, connection: DataConnection, code: string) => {
    if (message.kind === 'join') {
      const guest: PlayerProfile = { ...message.profile, name: message.profile.name.slice(0, 18), teamId: 'lunar', side: 'right' }
      const nextPlayers = [hostProfile, guest]
      playersRef.current = nextPlayers
      setPlayers(nextPlayers)
      setConnectionStatus('Both players connected')
      connection.send({ kind: 'lobby', players: nextPlayers, inviteCode: code } satisfies WireMessage)
    }
    if (message.kind === 'action') {
      const player = playersRef.current.find((candidate) => candidate.id === message.playerId)
      if (player && message.action.kind !== 'deliverMonster' && player.teamId === message.action.teamId) scheduleAuthoritativeAction(message.playerId, message.action)
    }
    if (message.kind === 'resyncRequest' && engineRef.current) {
      connection.send({ kind: 'resync', snapshot: engineRef.current.snapshot() } satisfies WireMessage)
    }
  }

  const joinMatch = () => {
    if (joinCode.trim().length < 6) {
      setNotice('Enter the six-character invite code.')
      return
    }
    closeNetwork()
    const safeName = savePreferences()
    const peer = new Peer({ debug: 1 })
    peerRef.current = peer
    setRole('guest')
    setPhase('lobby')
    setInviteCode(joinCode.trim().toUpperCase())
    setConnectionStatus('Finding the host…')
    peer.on('open', () => {
      const connection = peer.connect(`aa-${joinCode.trim().toLowerCase()}`, { reliable: true, serialization: 'json' })
      connectionRef.current = connection
      connection.on('open', () => {
        setConnectionStatus('Connected — introducing you to the host')
        connection.send({ kind: 'join', profile: { id: localId, name: safeName, mathsLevel } } satisfies WireMessage)
      })
      connection.on('data', (data) => handleGuestMessage(data as WireMessage))
      connection.on('close', () => setConnectionStatus('Host disconnected'))
      connection.on('error', () => setConnectionStatus('Connection lost'))
    })
    peer.on('error', () => setConnectionStatus('Match not found. Check the invite code.'))
  }

  const handleGuestMessage = (message: WireMessage) => {
    if (message.kind === 'lobby') {
      playersRef.current = message.players
      setPlayers(message.players)
      setConnectionStatus('Both players connected — host will start the battle')
    }
    if (message.kind === 'start' || message.kind === 'rematch') {
      engineRef.current = GameEngine.fromSnapshot(message.snapshot)
      pendingChecksumsRef.current.clear()
      setPendingQuestion(null)
      setSnapshot(message.snapshot)
      setPlayers(message.snapshot.players)
      setLocalTeamId('lunar')
      setPhase('game')
      setConnectionStatus('Peer-to-peer link active')
    }
    if (message.kind === 'command') {
      if (!engineRef.current?.schedule(message.command)) connectionRef.current?.send({ kind: 'resyncRequest', tick: message.command.tick } satisfies WireMessage)
    }
    if (message.kind === 'checksum' && engineRef.current) {
      const actual = engineRef.current.checksumAt(message.tick)
      if (actual && actual !== message.checksum) connectionRef.current?.send({ kind: 'resyncRequest', tick: message.tick } satisfies WireMessage)
      else if (!actual && message.tick > engineRef.current.tick) pendingChecksumsRef.current.set(message.tick, message.checksum)
    }
    if (message.kind === 'resync') {
      if (engineRef.current) engineRef.current.restore(message.snapshot)
      else engineRef.current = GameEngine.fromSnapshot(message.snapshot)
      pendingChecksumsRef.current.clear()
      setSnapshot(message.snapshot)
      setConnectionStatus('Peer-to-peer link active · state reconciled')
    }
    if (message.kind === 'error') setConnectionStatus(message.message)
  }

  const startMatch = () => {
    if (playersRef.current.length !== 2) return
    const engine = new GameEngine(playersRef.current)
    engineRef.current = engine
    setPendingQuestion(null)
    const first = engine.snapshot()
    setSnapshot(first)
    setLocalTeamId('solar')
    setPhase('game')
    connectionRef.current?.send({ kind: 'start', snapshot: first } satisfies WireMessage)
  }

  const startPractice = () => {
    closeNetwork()
    const safeName = savePreferences()
    const human: PlayerProfile = { id: localId, name: safeName, mathsLevel, teamId: 'solar', side: 'left' }
    const bot: PlayerProfile = { id: 'bot', name: 'Professor Byte', mathsLevel, teamId: 'lunar', side: 'right', isBot: true }
    const nextPlayers = [human, bot]
    const engine = new GameEngine(nextPlayers)
    engine.apply({ kind: 'upgradeSpawner', teamId: 'lunar', type: 'scout' })
    engine.apply({ kind: 'buildTower', teamId: 'lunar', type: 'bolt', col: 23, row: 3 })
    engineRef.current = engine
    playersRef.current = nextPlayers
    setPendingQuestion(null)
    setPlayers(nextPlayers)
    setSnapshot(engine.snapshot())
    setLocalTeamId('solar')
    setRole('practice')
    setConnectionStatus('Practice opponent active')
    setPhase('game')
  }

  const dispatchAction = (action: GameAction) => {
    if (role === 'guest') {
      connectionRef.current?.send({ kind: 'action', playerId: localId, action } satisfies WireMessage)
    } else if (role === 'host') {
      scheduleAuthoritativeAction(localId, action)
    } else {
      engineRef.current?.apply(action)
    }
  }

  const askForAction = (title: string, challenge: number, action: GameAction) => {
    const level = localPlayer?.mathsLevel ?? mathsLevel
    setPendingQuestion({ title, question: mathsGenerator.createQuestion(level, challenge), action })
  }

  const handleGridClick = (col: number, row: number) => {
    if (snapshot.status !== 'playing') return
    if (pendingQuestion) {
      flashNotice('Answer the current question to complete your move.')
      return
    }
    const onOwnSide = localTeamId === 'solar' ? col < WORLD.cols / 2 : col >= WORLD.cols / 2
    if (!onOwnSide) {
      flashNotice('That half belongs to your opponent.')
      return
    }
    if (terrainAt(col, row) === 'tree') {
      flashNotice('Trees block construction on that square.')
      return
    }
    if (isBaseFootprintCell(col, row)) {
      flashNotice('The base occupies that square.')
      return
    }
    const existing = snapshot.towers.find((tower) => tower.col === col && tower.row === row)
    if (existing) {
      if (existing.teamId !== localTeamId) return
      if (existing.level >= getMaxTowerLevel(existing.type)) {
        flashNotice('That tower is already at maximum power.')
        return
      }
      const meta = TOWER_META[existing.type]
      askForAction(`Upgrade ${meta.name} to level ${existing.level + 1}`, getTowerUpgradeChallenge(existing.type, existing.level + 1), {
        kind: 'upgradeTower', teamId: localTeamId, towerId: existing.id,
      })
      return
    }
    const meta = TOWER_META[selectedTower]
    askForAction(`Build a ${meta.name}`, meta.challenge, { kind: 'buildTower', teamId: localTeamId, type: selectedTower, col, row })
  }

  const chooseSpawner = (type: MonsterType) => {
    if (pendingQuestion) {
      flashNotice('Answer the current question to complete your move.')
      return
    }
    const spawner = snapshot.spawners.find((item) => item.teamId === localTeamId && item.type === type)!
    if (spawner.level >= MAX_SPAWNER_LEVEL) {
      flashNotice('That generator is already at maximum speed.')
      return
    }
    const meta = MONSTER_META[type]
    askForAction(spawner.level ? `Speed up ${meta.name} production` : `Awaken the ${meta.name} generator`, Math.min(3, meta.challenge + Math.floor(spawner.level / 2)), {
      kind: 'upgradeSpawner', teamId: localTeamId, type,
    })
  }

  const flashNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteCode)
    flashNotice('Invite code copied.')
  }

  const closeNetwork = () => {
    connectionRef.current?.close()
    peerRef.current?.destroy()
    connectionRef.current = null
    peerRef.current = null
  }

  const leaveGame = () => {
    closeNetwork()
    engineRef.current = null
    pendingChecksumsRef.current.clear()
    setPendingQuestion(null)
    setPhase('home')
    setPlayers([])
    setSnapshot(emptySnapshot())
  }

  if (phase === 'home') {
    return (
      <main className="setup-shell">
        <div className="setup-glow setup-glow-one" />
        <div className="setup-glow setup-glow-two" />
        <section className="setup-card">
          <div className="brand-lockup">
            <span className="brand-mark">A²</span>
            <div><p>Head-to-head maths defence</p><h1>Arithmetic<br /><em>Annihilation</em></h1></div>
          </div>
          <p className="setup-intro">Build clever. Spawn monsters. Outsmart your opponent — one maths question at a time.</p>
          <div className="setup-fields">
            <label><span>Player name</span><input value={name} maxLength={18} onChange={(event) => setName(event.target.value)} /></label>
            <label><span>Your maths level</span><select value={mathsLevel} onChange={(event) => setMathsLevel(event.target.value as MathsLevel)}>
              {MATHS_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label} — {level.note}</option>)}
            </select></label>
          </div>
          <div className="match-actions">
            <button className="primary-action" onClick={createMatch}><span>＋</span><strong>Create a match</strong><small>Get an invite code</small></button>
            <div className="or-divider"><span>or join a friend</span></div>
            <div className="join-row">
              <input aria-label="Invite code" placeholder="ABC123" value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
              <button onClick={joinMatch}>Join match</button>
            </div>
          </div>
          <button className="practice-link" onClick={startPractice}>Try a practice battle against Professor Byte →</button>
          <p className="peer-note"><span>●</span> WebRTC peer-to-peer · No account needed</p>
          {notice && <div className="toast">{notice}</div>}
        </section>
        <aside className="setup-art" aria-hidden="true">
          <div className="versus-badge">VS</div>
          <img className="hero-monster hero-monster-left" src={MONSTER_META.brute.sprite} />
          <img className="hero-monster hero-monster-right" src={MONSTER_META.titan.sprite} />
          <div className="math-bubble bubble-one">7 × 8</div><div className="math-bubble bubble-two">92 − 17</div>
        </aside>
      </main>
    )
  }

  if (phase === 'lobby') {
    const waiting = players.length < 2
    return (
      <main className="lobby-shell">
        <section className="lobby-card">
          <p className="eyebrow">Private peer lobby</p>
          <h1>{role === 'host' ? 'Your battle is ready' : 'Joining the battle…'}</h1>
          <p className="lobby-status"><span className={waiting ? 'status-dot pulse' : 'status-dot'} />{connectionStatus}</p>
          <div className="invite-panel">
            <span>Invite code</span><strong>{inviteCode}</strong>
            {role === 'host' && <button onClick={copyInvite}>Copy code</button>}
          </div>
          <div className="player-slots">
            {(['solar', 'lunar'] as TeamId[]).map((teamId) => {
              const player = players.find((candidate) => candidate.teamId === teamId)
              return <article key={teamId} className={`player-slot ${teamId}`}>
                <div className="player-orb">{player ? player.name.charAt(0).toUpperCase() : '?'}</div>
                <div><p>{TEAM_META[teamId].name}</p><h3>{player?.name || 'Waiting for player…'}</h3><span>{player ? MATHS_LEVELS.find((item) => item.value === player.mathsLevel)?.label : 'Maths level pending'}</span></div>
              </article>
            })}
          </div>
          {role === 'host' ? <button className="start-battle" disabled={waiting} onClick={startMatch}>Start the battle</button> : <p className="host-hint">The host will start when both players are ready.</p>}
          <button className="leave-link" onClick={leaveGame}>Leave lobby</button>
        </section>
        {notice && <div className="toast">{notice}</div>}
      </main>
    )
  }

  const opponentTeam: TeamId = localTeamId === 'solar' ? 'lunar' : 'solar'
  return (
    <main className={`game-shell local-${localTeamId}`}>
      <header className="game-header">
        <div className="mini-brand"><span>A²</span><strong>Arithmetic<br />Annihilation</strong></div>
        <PlayerHud teamId={localTeamId} snapshot={snapshot} label="YOU" />
        <div className="match-clock"><span>{formatTime(snapshot.elapsedMs)}</span><small>{connectionStatus}</small></div>
        <PlayerHud teamId={opponentTeam} snapshot={snapshot} label="RIVAL" />
        <button className="exit-button" onClick={leaveGame} aria-label="Exit match">×</button>
      </header>

      <div className="arena-layout">
        <MonsterLaunchRail teamId="solar" localTeamId={localTeamId} snapshot={snapshot} onChoose={chooseSpawner} />
        <section className="battle-stage">
          <GameCanvas snapshot={snapshot} localTeamId={localTeamId} selectedTower={selectedTower} onGridClick={handleGridClick} />
        </section>
        <MonsterLaunchRail teamId="lunar" localTeamId={localTeamId} snapshot={snapshot} onChoose={chooseSpawner} />
      </div>

      <footer className="command-deck">
        {pendingQuestion ? <MathsQuestionPanel
          title={pendingQuestion.title}
          question={pendingQuestion.question}
          onWrong={() => {
            dispatchAction({ kind: 'recordAnswer', teamId: localTeamId, correct: false })
            dispatchAction({ kind: 'wrongAnswer', teamId: localTeamId })
          }}
          onCorrect={() => {
            dispatchAction({ kind: 'recordAnswer', teamId: localTeamId, correct: true })
            dispatchAction(pendingQuestion.action)
            setPendingQuestion(null)
          }}
        /> : <div className="tower-picker">
          <div className="deck-title"><span>DEFENCE</span><strong>Choose a tower</strong><small>then click your half of the map</small></div>
          {TOWER_TYPES.map((type) => {
            const meta = TOWER_META[type]
            return <button key={type} className={selectedTower === type ? 'tower-card is-selected' : 'tower-card'} onClick={() => setSelectedTower(type)}>
              <img src={meta.sprite} /><span><strong>{meta.shortName}</strong><small>{['Easy', 'Medium', 'Hard', 'Very hard'][meta.challenge]} maths</small></span>
            </button>
          })}
        </div>}
        <div className="battle-log"><span>2 PLAYER · LIVE</span><p>{snapshot.events[0] || 'Build towers and send monsters to the rival base.'}</p></div>
      </footer>

      {snapshot.teams[localTeamId].comebackBoost > 0 && <div className="rally-banner">RALLY BOOST · Your towers and base are fighting back</div>}
      {notice && <div className="toast">{notice}</div>}
    </main>
  )
}

function PlayerHud({ teamId, snapshot, label }: { teamId: TeamId; snapshot: GameSnapshot; label: string }) {
  const player = snapshot.players.find((candidate) => candidate.teamId === teamId)
  const team = snapshot.teams[teamId]
  return <div className={`player-hud ${teamId}`}>
    <div className="player-hud-copy"><span>{label} · {TEAM_META[teamId].sideLabel}</span><strong>{player?.name || TEAM_META[teamId].name}</strong></div>
    <div className="base-health"><div><span style={{ width: `${team.baseHealth}%` }} /></div><strong>{Math.ceil(team.baseHealth)} HP</strong></div>
    <div className="answer-stats" aria-label={`${team.answerStats.correct} correct and ${team.answerStats.wrong} wrong answers`}>
      <span className="correct"><strong>{team.answerStats.correct}</strong> ✓</span>
      <span className="wrong"><strong>{team.answerStats.wrong}</strong> ×</span>
    </div>
  </div>
}

function MonsterLaunchRail({ teamId, localTeamId, snapshot, onChoose }: { teamId: TeamId; localTeamId: TeamId; snapshot: GameSnapshot; onChoose: (type: MonsterType) => void }) {
  const isLocal = teamId === localTeamId
  return <aside className={`monster-launch-rail ${teamId} ${isLocal ? 'is-local' : 'is-rival'}`} aria-label={`${isLocal ? 'Your' : 'Rival'} monster spawners`}>
    <div className="launch-rail-heading"><strong>{isLocal ? 'SEND' : 'RIVAL'}</strong><span>{isLocal ? 'MONSTERS' : 'SPAWNS'}</span></div>
    <div className="launch-list">
    {MONSTER_TYPES.map((type) => {
      const meta = MONSTER_META[type]
      const spawner = snapshot.spawners.find((item) => item.teamId === teamId && item.type === type)!
      const label = `${meta.name}: ${spawner.level ? `level ${spawner.level}` : 'not active'}${isLocal ? '. Answer a maths question to upgrade.' : ''}`
      return <div className="monster-launch" key={type}>
        <button className="monster-launch-button" aria-label={label} title={label} disabled={!isLocal || snapshot.status !== 'playing'} onClick={() => onChoose(type)}>
          <img src={meta.sprite} className={`${teamId !== localTeamId ? 'opponent-sprite' : ''} ${teamId === 'lunar' ? 'faces-left' : ''}`} />
          <span className="launch-level">{spawner.level ? `L${spawner.level}` : 'OFF'}</span>
          <span className="launch-progress" aria-hidden="true"><span style={{ width: `${spawner.progress * 100}%` }} /></span>
        </button>
        <span className="launch-arrow" aria-hidden="true" />
      </div>
    })}
    </div>
    <p className="launch-help">{isLocal ? 'Click to unlock or speed up' : 'Opponent attack rate'}</p>
  </aside>
}

function runBotMove(engine: GameEngine, snapshot: GameSnapshot) {
  const unlocked = snapshot.spawners.filter((item) => item.teamId === 'lunar' && item.level < MAX_SPAWNER_LEVEL)
  if (Math.random() < 0.48 && unlocked.length) {
    const target = unlocked[Math.floor(Math.random() * unlocked.length)]
    engine.apply({ kind: 'upgradeSpawner', teamId: 'lunar', type: target.type })
    return
  }
  const occupied = new Set(snapshot.towers.map((tower) => `${tower.col}:${tower.row}`))
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const col = WORLD.cols / 2 + 1 + Math.floor(Math.random() * (WORLD.cols / 2 - 3))
    const row = Math.floor(Math.random() * WORLD.rows)
    if (!occupied.has(`${col}:${row}`)) {
      const type = TOWER_TYPES[Math.floor(Math.random() * TOWER_TYPES.length)]
      engine.apply({ kind: 'buildTower', teamId: 'lunar', type, col, row })
      return
    }
  }
}
