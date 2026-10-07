/** @jsxImportSource preact */
import { Choices } from './choices.tsx'
import type { JSX } from 'preact'
import { Portrait } from './portrait.tsx'
import { Slot } from './slot.tsx'
import type { SlotProps } from '../slots.ts'
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

export function DialogueOverlay({ dialogue, advance, choose, dismissDialogue }: SlotProps['Dialogue']): JSX.Element {
  return (
    <div style={OVERLAY_STYLE}>
      {dialogue.type === 'line'
        ? (
          <button onClick={advance} style={LINE_BUTTON_STYLE} type="button">
            {dialogue.portrait !== undefined && <Slot builtIn={Portrait} name="Dialogue.Portrait" speaker={dialogue.speaker} src={dialogue.portrait} />}
            <span style={SPEAKER_LABEL_STYLE}>{dialogue.speaker}</span>
            <span style={LINE_TEXT_STYLE}>{dialogue.text}</span>
          </button>
        )
        : <Slot builtIn={Choices} choices={dialogue.choices} choose={choose} name="Choices" />}
      {dialogue.canDismiss && (
        <button onClick={dismissDialogue} style={CLOSE_BUTTON_STYLE} type="button">
          {CLOSE_LABEL}
        </button>
      )}
    </div>
  )
}
