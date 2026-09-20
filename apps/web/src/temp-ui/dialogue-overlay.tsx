'use client'

import type { Dialogue } from '../scripts/script.ts'

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

// A named constant, not an inline literal: `react/jsx-no-literals` and `jsx-curly-brace-presence` disagree on how a bare JSX text literal should look, and referencing a variable satisfies both.
const CLOSE_LABEL = 'Close'

export function DialogueOverlay({
  dialogue,
  onDismiss,
}: {
  dialogue: Dialogue
  onDismiss: () => void
}): React.ReactElement {
  return (
    <div style={OVERLAY_STYLE}>
      {dialogue.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <button onClick={onDismiss} type="button">
        {CLOSE_LABEL}
      </button>
    </div>
  )
}
