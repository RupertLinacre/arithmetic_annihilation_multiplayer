import { describe, expect, it, vi } from 'vitest'
import { CanvasProjectileEffects } from './canvasProjectileEffects'

describe('CanvasProjectileEffects', () => {
  it('pre-inverts opposing colours without using a canvas filter', () => {
    const effects = new CanvasProjectileEffects()
    effects.spawnExplosion('solar', 100, 100, 20)
    effects.spawnExplosion('lunar', 200, 100, 20)

    let filterAssignments = 0
    let fillStyle = ''
    const renderedFillStyles: string[] = []
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(() => renderedFillStyles.push(fillStyle)),
      set fillStyle(value: string | CanvasGradient | CanvasPattern) {
        fillStyle = String(value)
      },
      get fillStyle() {
        return fillStyle
      },
      set filter(_value: string) {
        filterAssignments += 1
      },
    } as unknown as CanvasRenderingContext2D

    effects.render(context, 'solar')

    expect(context.fill).toHaveBeenCalled()
    expect(context.save).not.toHaveBeenCalled()
    expect(context.restore).not.toHaveBeenCalled()
    expect(filterAssignments).toBe(0)
    expect(renderedFillStyles).toContain('rgba(255,242,176,0.95)')
    expect(renderedFillStyles).toContain('rgba(0,13,79,0.95)')
  })
})
