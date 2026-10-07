'use client'

import { currentLocale, resolveText } from '../state/strings.ts'
import type { ShownChoice } from '@codeleagues-rpg-engine/clsc'
import { useCallback } from 'react'

const CHOICE_STYLE = {
  display: 'block',
  margin: '0 0 0.5rem',
} as const

const LOCKED_REASON_STYLE = {
  marginLeft: '0.5rem',
  opacity: 0.7,
} as const

export function ScriptChoices({ choices, onChoose }: { choices: ShownChoice[]; onChoose: (index: number) => void }): React.ReactElement {
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
    onChoose(Number(event.currentTarget.dataset.index))
  }, [onChoose])

  return (
    <>
      {choices.map((choice, index) => (
        // Labels can repeat, so the position is the only stable key.
        // oxlint-disable-next-line react/no-array-index-key
        <span key={index} style={CHOICE_STYLE}>
          <button data-index={index} disabled={choice.locked !== undefined} onClick={handleClick} type="button">
            {resolveText(choice, currentLocale)}
          </button>
          {choice.locked && <span style={LOCKED_REASON_STYLE}>{resolveText(choice.locked, currentLocale)}</span>}
        </span>
      ))}
    </>
  )
}
