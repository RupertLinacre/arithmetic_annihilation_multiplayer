import { describe, expect, it } from 'vitest'
import { DEFAULT_MATHS_LEVEL, MathsQuestionGenerator, mapChallengeToYearLevel } from './maths'

describe('reference maths question generation', () => {
  it('uses Year 2 as the requested base difficulty', () => {
    expect(DEFAULT_MATHS_LEVEL).toBe('year2')
    expect(mapChallengeToYearLevel()).toBe('year2')
  })

  it('maps the four challenge bands with the reference year offsets', () => {
    expect(mapChallengeToYearLevel('year2', 0)).toBe('year2')
    expect(mapChallengeToYearLevel('year2', 1)).toBe('year3')
    expect(mapChallengeToYearLevel('year2', 2)).toBe('year4')
    expect(mapChallengeToYearLevel('year2', 3)).toBe('year5')
    expect(mapChallengeToYearLevel('year5', 3)).toBe('year6')
  })

  it('uses the package expression, answer and four-choice format', () => {
    const generator = new MathsQuestionGenerator('test-seed')
    const question = generator.createQuestion('year2', 0)
    expect(question.levelLabel).toBe('Year 2')
    expect(question.choices).toHaveLength(4)
    expect(question.choices).toContain(question.answer)
    expect(question.prompt.length).toBeGreaterThan(0)
  })

  it('rotates through every problem type supported at the selected level', () => {
    const generator = new MathsQuestionGenerator('all-problem-types')
    const types = new Set(Array.from({ length: 6 }, () => generator.createQuestion('year2', 0).type))
    expect(types).toEqual(new Set(['addition', 'subtraction', 'multiplication', 'division', 'squared', 'fraction']))
  })

  it('includes the new fraction problem type in the higher-level rotation', () => {
    const generator = new MathsQuestionGenerator('fraction-problem-type')
    const types = new Set(Array.from({ length: 7 }, () => generator.createQuestion('year5', 0).type))
    expect(types).toEqual(new Set(['addition', 'subtraction', 'multiplication', 'division', 'squared', 'cube', 'fraction']))
  })
})
