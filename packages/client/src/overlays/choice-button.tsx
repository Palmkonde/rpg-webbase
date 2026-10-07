/** @jsxImportSource preact */
import type { JSX } from 'preact'
import type { SlotProps } from '../slots.ts'
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

export function ChoiceButton({ choice, index, choose }: SlotProps['Choices.Button']): JSX.Element {
  const handleClick = useCallback((): void => { choose(index) }, [choose, index])

  return (
    <span style={CHOICE_STYLE}>
      <button disabled={choice.locked !== undefined} onClick={handleClick} style={BUTTON_STYLE} type="button">
        {choice.text}
      </button>
      {choice.locked !== undefined && <span style={LOCKED_REASON_STYLE}>{choice.locked}</span>}
    </span>
  )
}
