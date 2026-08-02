import { useState } from 'react'
import type { MathsQuestion } from '../game/types'
import { assetUrl } from '../game/config'

interface Props {
  title: string
  question: MathsQuestion
  onWrong: () => void
  onCorrect: () => void
}

export function MathsQuestionPanel({ title, question, onWrong, onCorrect }: Props) {
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
    <section className="maths-question-panel" aria-labelledby="question-title">
      <div className="question-heading">
        <span>{question.levelLabel} challenge</span>
        <strong id="question-title">{title}</strong>
        <small className={wrong ? 'is-wrong' : ''}>{wrong ? 'Wrong answer — rival Nibble production increased' : 'Choose the correct answer to complete your move'}</small>
      </div>
      <p className="question-prompt">{question.prompt} <span>= ?</span></p>
      <div className="answer-grid">
        {question.choices.map((choice) => (
          <button key={choice} disabled={wrong && choice !== question.answer} onClick={() => answer(choice)}>{choice}</button>
        ))}
      </div>
    </section>
  )
}
