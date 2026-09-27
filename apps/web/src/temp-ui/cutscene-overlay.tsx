'use client'

import type { DialogueLine } from '../scripts/script.ts'

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

export function CutsceneOverlay({
  line,
  onAdvance,
}: {
  line: DialogueLine
  onAdvance: () => void
}): React.ReactElement {
  return (
    <div style={OVERLAY_STYLE}>
      <button onClick={onAdvance} style={LINE_BUTTON_STYLE} type="button">
        {line.speaker !== undefined && <span style={SPEAKER_LABEL_STYLE}>{line.speaker}</span>}
        <span style={LINE_TEXT_STYLE}>{line.text}</span>
      </button>
    </div>
  )
}
