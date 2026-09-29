'use client'

import type { Choice, DialogueLine } from '../scripts/script.ts'
import { useCallback, useState } from 'react'

// Unlike DialogueOverlay there is no Close control — a Cutscene takes control from the Player for its duration (spec's "Cutscene freeze"), it isn't dismissible.
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

// A real <button>, not a <div onClick>, so the click-to-advance region is keyboard-operable (matches DialogueOverlay's jsx-a11y reasoning).
const LINE_BUTTON_STYLE = {
  display: 'block',
  width: '100%',
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
} as const

const SPEAKER_LABEL_STYLE = {
  display: 'block',
  margin: '0 0 0.15rem',
  fontWeight: 'bold',
} as const

const LINE_TEXT_STYLE = {
  display: 'block',
  margin: 0,
} as const

const DISABLED_CHOICE_STYLE = {
  opacity: 0.5,
  cursor: 'not-allowed',
} as const

export function CutsceneOverlay({
  choices,
  line,
  onAdvance,
  onChoose,
}: {
  choices: Choice[] | undefined
  line: DialogueLine | undefined
  onAdvance: () => void
  onChoose: (choice: Choice) => void
}): React.ReactElement {
  const [blockedReason, setBlockedReason] = useState<string | undefined>()

  // Dispatches by position: `flags` is optional and, even set, isn't a per-choice id.
  const handleChoiceClick = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
    const { index } = event.currentTarget.dataset
    const choice = choices?.[Number(index)]
    if (!choice) {return}
    if (choice.enabled === false) {
      setBlockedReason(choice.disabledReason)
      return
    }
    setBlockedReason(undefined)
    onChoose(choice)
  }, [choices, onChoose])

  const visibleChoices = choices
    ?.map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => choice.visible !== false)

  return (
    <div style={OVERLAY_STYLE}>
      {line && (
        <button onClick={onAdvance} style={LINE_BUTTON_STYLE} type="button">
          {line.speaker !== undefined && <span style={SPEAKER_LABEL_STYLE}>{line.speaker}</span>}
          <span style={LINE_TEXT_STYLE}>{line.text}</span>
        </button>
      )}
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
    </div>
  )
}
