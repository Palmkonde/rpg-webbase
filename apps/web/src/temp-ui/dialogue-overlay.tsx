'use client'

import type { Choice, Dialogue } from '../scripts/script.ts'
import { useCallback, useState } from 'react'

// Non-blocking per ADR-0011: no Host→Engine pause channel exists, so this never stops the Player.
const OVERLAY_STYLE = {
  position: 'fixed',
  left: '50%',
  bottom: '5%',
  transform: 'translateX(-50%)',
  maxWidth: '32rem',
  padding: '1rem 1.5rem',
  background: 'rgba(20, 20, 20, 0.9)',
  color: 'white',
  borderRadius: '0.5rem',
} as const

const DISABLED_CHOICE_STYLE = {
  opacity: 0.5,
  cursor: 'not-allowed',
} as const

// A named constant, not an inline literal: `react/jsx-no-literals` and `jsx-curly-brace-presence` disagree on how a bare JSX text literal should look, and referencing a variable satisfies both.
const CLOSE_LABEL = 'Close'

export function DialogueOverlay({
  dialogue,
  onDismiss,
  onChoose,
}: {
  dialogue: Dialogue
  onDismiss: () => void
  onChoose: (choice: Choice) => void
}): React.ReactElement {
  const [blockedReason, setBlockedReason] = useState<string | undefined>()

  // Dispatches by position, not `flags` — `flags` is optional (a no-op choice) and, even set, isn't a per-choice id.
  const handleChoiceClick = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
    const { index } = event.currentTarget.dataset
    const choice = dialogue.choices?.[Number(index)]
    if (!choice) {return}
    if (choice.enabled === false) {
      setBlockedReason(choice.disabledReason)
      return
    }
    setBlockedReason(undefined)
    onChoose(choice)
  }, [dialogue.choices, onChoose])

  // `visible: false` choices are omitted here, at render time — the built Dialogue keeps every choice, conditions included.
  const visibleChoices = dialogue.choices
    ?.map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => choice.visible !== false)

  return (
    <div style={OVERLAY_STYLE}>
      {dialogue.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {visibleChoices?.map(({ choice, index }) => {
        const isDisabled = choice.enabled === false
        return (
          <button
            aria-disabled={isDisabled}
            data-index={index}
            key={choice.text}
            onClick={handleChoiceClick}
            style={isDisabled ? DISABLED_CHOICE_STYLE : undefined}
            type="button"
          >
            {choice.text}
          </button>
        )
      })}
      {blockedReason && <p aria-live="polite">{blockedReason}</p>}
      <button onClick={onDismiss} type="button">
        {CLOSE_LABEL}
      </button>
    </div>
  )
}
