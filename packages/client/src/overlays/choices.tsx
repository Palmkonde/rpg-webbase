/** @jsxImportSource preact */
import type { JSX, TargetedMouseEvent } from 'preact'
import type { ChoiceView } from '../session.ts'
import { useCallback } from 'preact/hooks'

const CHOICE_STYLE = {
  display: 'block',
  margin: '0 0 0.5rem',
} as const

const BUTTON_STYLE = { font: 'inherit' } as const

const LOCKED_REASON_STYLE = {
  marginLeft: '0.5rem',
  opacity: 0.7,
} as const

export function Choices({ choices, onChoose }: { choices: ChoiceView[]; onChoose: (index: number) => void }): JSX.Element {
  const handleClick = useCallback((event: TargetedMouseEvent<HTMLButtonElement>): void => {
    onChoose(Number(event.currentTarget.dataset.index))
  }, [onChoose])

  return (
    <>
      {choices.map((choice, index) => (
        // Labels can repeat, so the position is the only stable key.
        // oxlint-disable-next-line react/no-array-index-key
        <span key={index} style={CHOICE_STYLE}>
          <button data-index={index} disabled={choice.locked !== undefined} onClick={handleClick} style={BUTTON_STYLE} type="button">
            {choice.text}
          </button>
          {choice.locked !== undefined && <span style={LOCKED_REASON_STYLE}>{choice.locked}</span>}
        </span>
      ))}
    </>
  )
}
