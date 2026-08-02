import type { ProjectileState, ProjectileType, TeamId } from './types'

const MAX_PARTICLES = 1400

interface Particle {
  x: number; y: number; vx: number; vy: number; ageMs: number; lifeMs: number
  startSize: number; endSize: number; startColor: number; endColor: number
  startAlpha: number; endAlpha: number; drag: number; gravity: number; glow: boolean; teamId: TeamId
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

function colour(value: number, alpha: number) {
  const red = value >> 16 & 0xff
  const green = value >> 8 & 0xff
  const blue = value & 0xff
  return `rgba(${red},${green},${blue},${alpha})`
}

function lerpColour(a: number, b: number, t: number) {
  const red = Math.round(lerp(a >> 16 & 0xff, b >> 16 & 0xff, t))
  const green = Math.round(lerp(a >> 8 & 0xff, b >> 8 & 0xff, t))
  const blue = Math.round(lerp(a & 0xff, b & 0xff, t))
  return red << 16 | green << 8 | blue
}

const invertColour = (value: number) => value ^ 0xffffff

export class CanvasProjectileEffects {
  private particles: Particle[] = []
  private accumulators = new Map<number, number>()

  private spawn(teamId: TeamId, x: number, y: number, vx: number, vy: number, lifeMs: number, startSize: number, endSize: number, startColor: number, endColor: number, startAlpha: number, endAlpha: number, drag: number, gravity: number, glow: boolean) {
    if (this.particles.length >= MAX_PARTICLES) return
    this.particles.push({ teamId, x, y, vx, vy, ageMs: 0, lifeMs, startSize, endSize, startColor, endColor, startAlpha, endAlpha, drag, gravity, glow })
  }

  emitTrails(projectiles: readonly ProjectileState[], deltaMs: number, extrapolationSeconds: number) {
    const active = new Set(projectiles.map((projectile) => projectile.id))
    for (const id of this.accumulators.keys()) if (!active.has(id)) this.accumulators.delete(id)
    for (const source of projectiles) {
      const projectile = { ...source, x: source.x + source.vx * extrapolationSeconds, y: source.y + source.vy * extrapolationSeconds }
      const interval = projectile.type === 'missile' ? 16 / (projectile.trailScale ?? 1)
        : projectile.type === 'cluster' ? 20 : projectile.type === 'fragment' ? 16 : projectile.visualType === 'spray' ? 12 : 18
      let accumulator = (this.accumulators.get(projectile.id) ?? 0) + deltaMs
      while (accumulator >= interval) {
        accumulator -= interval
        this.emitTrailParticle(projectile)
        if (this.particles.length >= MAX_PARTICLES) { accumulator = 0; break }
      }
      this.accumulators.set(projectile.id, accumulator)
    }
  }

  private emitTrailParticle(projectile: ProjectileState) {
    const speed = Math.hypot(projectile.vx, projectile.vy) || 1
    const dirX = projectile.vx / speed
    const dirY = projectile.vy / speed
    const tailX = projectile.x - dirX * (projectile.radius + 2)
    const tailY = projectile.y - dirY * (projectile.radius + 2)
    const sideX = -dirY
    const sideY = dirX
    if (projectile.type === 'missile') {
      const scale = projectile.trailScale ?? 1
      this.spawn(projectile.teamId, tailX, tailY, dirX * -24 + randomBetween(-12, 12), dirY * -24 + randomBetween(-12, 12), 170 * scale, 4.2, 1.2, 0xffe28a, 0xff5a1a, .95, 0, 2.4, 0, true)
      this.spawn(projectile.teamId, tailX + randomBetween(-1.5, 1.5), tailY + randomBetween(-1.5, 1.5), dirX * -10 + randomBetween(-7, 7), dirY * -10 + randomBetween(-7, 7) - 6, 560 * scale, 2.6, 8.5, 0xc8c2b6, 0x4a443d, .5, 0, 1.6, -8, false)
    } else if (projectile.type === 'cluster') {
      this.spawn(projectile.teamId, tailX, tailY, randomBetween(-13, 13), randomBetween(-13, 13), 320, 3.4, .6, 0xffa8e6, 0x7a2f8f, .85, 0, 1.8, 0, true)
    } else if (projectile.type === 'fragment') {
      const heat = Math.max(0, Math.min(1, projectile.lifeMs / projectile.maxLifeMs))
      const hot = heat > .66 ? 0xffffff : heat > .38 ? 0xff8a16 : heat > .16 ? 0xd82712 : 0x15100d
      const cool = heat > .66 ? 0xffb32b : heat > .38 ? 0xe13012 : heat > .16 ? 0x220d08 : 0x050403
      this.spawn(projectile.teamId, tailX, tailY, dirX * randomBetween(-18, -4) + randomBetween(-9, 9), dirY * randomBetween(-18, -4) + randomBetween(-9, 9), 190, 2.8, .5, hot, cool, .9, 0, 2, 0, heat > .25)
      if (heat < .35) this.spawn(projectile.teamId, tailX + randomBetween(-1.5, 1.5), tailY + randomBetween(-1.5, 1.5), dirX * -8 + randomBetween(-6, 6), dirY * -8 + randomBetween(-6, 6) - 4, 300, 1.6, 5.8, 0x2b241f, 0x050403, .45, 0, 1.1, -4, false)
    } else if (projectile.visualType === 'spray') {
      const offset = randomBetween(-7, 7)
      const sprayColour = Math.random() > .5 ? 0x42f5ff : 0xff4fd8
      this.spawn(projectile.teamId, tailX + sideX * offset, tailY + sideY * offset, dirX * randomBetween(-40, -16) + sideX * randomBetween(-32, 32), dirY * randomBetween(-40, -16) + sideY * randomBetween(-32, 32), 260, 3.1, .4, 0xffffff, sprayColour, .75, 0, 2.8, 0, true)
      this.spawn(projectile.teamId, tailX - dirX * 4, tailY - dirY * 4, sideX * randomBetween(-16, 16), sideY * randomBetween(-16, 16), 140, 5.4, 1.2, 0x6ffcff, 0xff5bd6, .18, 0, 1.8, 0, true)
    } else {
      this.spawn(projectile.teamId, tailX - dirX * 8, tailY - dirY * 8, dirX * -28 + randomBetween(-6, 6), dirY * -28 + randomBetween(-6, 6), 165, 4.4, .4, 0xffffff, 0xffb300, .9, 0, 2, 0, true)
      this.spawn(projectile.teamId, tailX, tailY, randomBetween(-11, 11), randomBetween(-11, 11), 95, 1.5, .2, 0xfff3c4, 0xff6f1a, .7, 0, 2.5, 0, false)
    }
  }

  spawnImpact(teamId: TeamId, x: number, y: number, type: ProjectileType) {
    const sparks = type === 'missile' ? 10 : 6
    for (let index = 0; index < sparks; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = randomBetween(70, 200)
      this.spawn(teamId, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, randomBetween(220, 340), type === 'missile' ? 3 : 2.2, .4, 0xfff1b0, 0xff6a1a, .9, 0, 3, 40, true)
    }
    if (type === 'missile') this.spawnSmoke(teamId, x, y, 4, .7)
  }

  spawnExplosion(teamId: TeamId, x: number, y: number, radius: number) {
    for (let index = 0; index < 16; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = radius * 1.1 * randomBetween(1.4, 3.6)
      this.spawn(teamId, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, randomBetween(280, 540), 3.4, .5, 0xfff2b0, 0xff3b00, .95, 0, 3.2, 90, true)
    }
    this.spawn(teamId, x, y, 0, 0, 130, radius * .5, radius * .18, 0xfff6cf, 0xffae3b, .85, 0, 0, 0, true)
    this.spawnSmoke(teamId, x, y, 6, 1)
  }

  private spawnSmoke(teamId: TeamId, x: number, y: number, count: number, scale: number) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = randomBetween(10, 36) * scale
      this.spawn(teamId, x + randomBetween(-3, 3), y + randomBetween(-3, 3), Math.cos(angle) * speed, Math.sin(angle) * speed - 12, randomBetween(620, 940), 4 * scale, 14 * scale, 0xb6b0a4, 0x3a352e, .5, 0, 1.4, -14, false)
    }
  }

  update(deltaMs: number) {
    const dt = deltaMs / 1000
    this.particles = this.particles.filter((particle) => {
      particle.ageMs += deltaMs
      if (particle.ageMs >= particle.lifeMs) return false
      const drag = Math.max(0, 1 - particle.drag * dt)
      particle.vx *= drag; particle.vy *= drag; particle.vy += particle.gravity * dt
      particle.x += particle.vx * dt; particle.y += particle.vy * dt
      return true
    })
  }

  render(ctx: CanvasRenderingContext2D, localTeamId: TeamId) {
    this.renderTeam(ctx, localTeamId, false)
    const opposingTeamId: TeamId = localTeamId === 'solar' ? 'lunar' : 'solar'
    this.renderTeam(ctx, opposingTeamId, true)
  }

  private renderTeam(ctx: CanvasRenderingContext2D, teamId: TeamId, inverted: boolean) {
    for (const particle of this.particles) {
      if (particle.teamId !== teamId) continue
      const t = particle.ageMs / particle.lifeMs
      const size = lerp(particle.startSize, particle.endSize, t)
      const alpha = lerp(particle.startAlpha, particle.endAlpha, t)
      if (size <= .05 || alpha <= .01) continue
      const baseFill = lerpColour(particle.startColor, particle.endColor, t)
      const fill = inverted ? invertColour(baseFill) : baseFill
      if (particle.glow) { ctx.fillStyle = colour(fill, alpha * .28); ctx.beginPath(); ctx.arc(particle.x, particle.y, size * 1.9, 0, Math.PI * 2); ctx.fill() }
      ctx.fillStyle = colour(fill, alpha); ctx.beginPath(); ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2); ctx.fill()
    }
  }
}
