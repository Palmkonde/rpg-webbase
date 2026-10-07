/** @jsxImportSource preact */
import { Choices } from './choices.tsx'
import type { DialogueView } from '../views.ts'
import type { JSX } from 'preact'
import { theme } from './theme.ts'

// The one overlay for every VM run (adr/0030).
const OVERLAY_STYLE = {
  position: 'absolute',
  left: '50%',
  bottom: '5%',
  transform: 'translateX(-50%)',
  maxWidth: '32rem',
  padding: '1rem 1.5rem',
  background: theme.panelBackground,
  color: theme.text,
  font: theme.font,
  borderRadius: theme.panelRadius,
} as const

// A real <button>, not a <div onClick>, so click-to-advance is keyboard-operable (jsx-a11y).
const LINE_BUTTON_STYLE = {
  display: 'block',
  width: '100%',
  margin: '0 0 0.75rem',
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
} as const

const PORTRAIT_SIZE = 96

// `float`, not a flex wrapper `<div>`, to stay phrasing content inside the `<button>`.
const PORTRAIT_STYLE = {
  float: 'left',
  width: `${PORTRAIT_SIZE}px`,
  height: `${PORTRAIT_SIZE}px`,
  marginRight: '0.75rem',
  borderRadius: '0.25rem',
  objectFit: 'cover',
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

const CLOSE_BUTTON_STYLE = { font: 'inherit' } as const

// A named constant: `react/jsx-no-literals` and `jsx-curly-brace-presence` disagree on a bare JSX text literal.
const CLOSE_LABEL = 'Close'

export function DialogueOverlay({
  dialogue,
  onAdvance,
  onChoose,
  onDismiss,
}: {
  dialogue: DialogueView
  onAdvance: () => void
  onChoose: (index: number) => void
  onDismiss: () => void
}): JSX.Element {
  return (
    <div style={OVERLAY_STYLE}>
      {dialogue.type === 'line'
        ? (
          <button onClick={onAdvance} style={LINE_BUTTON_STYLE} type="button">
            {/* Not a Next app, so there's no `next/image` to use. */}
            {/* oxlint-disable-next-line next/no-img-element */}
            {dialogue.portrait !== undefined && <img alt="" height={PORTRAIT_SIZE} src={dialogue.portrait} style={PORTRAIT_STYLE} width={PORTRAIT_SIZE} />}
            <span style={SPEAKER_LABEL_STYLE}>{dialogue.speaker}</span>
            <span style={LINE_TEXT_STYLE}>{dialogue.text}</span>
          </button>
        )
        : <Choices choices={dialogue.choices} onChoose={onChoose} />}
      {dialogue.canDismiss && (
        <button onClick={onDismiss} style={CLOSE_BUTTON_STYLE} type="button">
          {CLOSE_LABEL}
        </button>
      )}
    </div>
  )
}
