import { useState } from 'react'
import type { MathsQuestion } from '../game/types'
import { assetUrl } from '../game/config'

interface Props {
  title: string
  question: MathsQuestion
  correctCount: number
  wrongCount: number
  onWrong: () => void
  onCorrect: () => void
}

export function MathsModal({ title, question, correctCount, wrongCount, onWrong, onCorrect }: Props) {
  const [wrong, setWrong] = useState(false)

  const answer = (choice: string) => {
    if (wrong && choice !== question.answer) return
    if (choice === question.answer) {
      new Audio(assetUrl('audio/pop.mp3')).play().catch(() => undefined)
      onCorrect()
    } else {
      setWrong(true)
      onWrong()
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="maths-modal" role="dialog" aria-modal="true" aria-labelledby="question-title">
        <p className="eyebrow">{question.levelLabel} challenge</p>
        <h2 id="question-title">{title}</h2>
        <div className="answer-score" aria-label="Questions answered">
          <span><strong>{correctCount}</strong> correct</span>
          <span><strong>{wrongCount}</strong> wrong</span>
        </div>
        <p className="question-prompt">{question.prompt} <span>= ?</span></p>
        <div className="answer-grid">
          {question.choices.map((choice) => (
            <button key={choice} disabled={wrong && choice !== question.answer} onClick={() => answer(choice)}>{choice}</button>
          ))}
        </div>
        <p className={wrong ? 'answer-feedback is-wrong' : 'answer-feedback'}>
          {wrong ? `Not quite. Nibble production increased for your opponent — choose the correct answer to continue.` : 'Pick the correct answer to complete your move.'}
        </p>
      </section>
    </div>
  )
}
