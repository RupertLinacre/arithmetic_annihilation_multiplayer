import { useState, type FormEvent } from 'react'
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
  const [response, setResponse] = useState('')

  const answer = (submittedAnswer: string) => {
    if (!submittedAnswer || (wrong && submittedAnswer !== question.answer)) return
    if (submittedAnswer === question.answer) {
      new Audio(assetUrl('audio/pop.mp3')).play().catch(() => undefined)
      onCorrect()
    } else {
      setWrong(true)
      setResponse('')
      onWrong()
    }
  }

  const submitAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    answer(response.trim())
  }

  const updateResponse = (nextResponse: string) => {
    setResponse(nextResponse)
    if (nextResponse.trim() === question.answer) answer(question.answer)
  }

  return (
    <section className="maths-question-panel" aria-labelledby="question-title">
      <div className="question-heading">
        <span>{question.levelLabel} challenge</span>
        <strong id="question-title">{title}</strong>
        <small className={wrong ? 'is-wrong' : ''}>{wrong ? 'Wrong answer — rival Nibble production increased. Try again.' : 'Type the correct answer to complete your move'}</small>
      </div>
      <p className="question-prompt">{question.prompt} <span>= ?</span></p>
      <form className="answer-form" onSubmit={submitAnswer}>
        <label className="sr-only" htmlFor="maths-answer">Your answer</label>
        <input
          id="maths-answer"
          autoComplete="off"
          autoFocus
          inputMode="text"
          value={response}
          onChange={(event) => updateResponse(event.target.value)}
          placeholder="Your answer"
        />
        <button type="submit">Submit</button>
      </form>
    </section>
  )
}
