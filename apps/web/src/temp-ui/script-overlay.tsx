'use client'

import { currentLocale, resolveText } from '../state/strings.ts'
import { ScriptChoices } from './script-choices.tsx'
import type { ScriptPrompt } from '../game/script-player.ts'
import { resolvePortrait } from '../state/portraits.ts'

// The one overlay for every VM run (adr/0030).
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

// A named constant: `react/jsx-no-literals` and `jsx-curly-brace-presence` disagree on a bare JSX text literal.
const CLOSE_LABEL = 'Close'

// Dismiss shows only while not frozen: a Cutscene or CG has control of the Player until it unfreezes (adr/0030).
export function ScriptOverlay({
  prompt,
  frozen,
  onAdvance,
  onChoose,
  onDismiss,
}: {
  prompt: ScriptPrompt
  frozen: boolean
  onAdvance: () => void
  onChoose: (index: number) => void
  onDismiss: () => void
}): React.ReactElement {
  const portrait = prompt.type === 'line' ? resolvePortrait(prompt.speaker, prompt.expression) : undefined

  return (
    <div style={OVERLAY_STYLE}>
      {prompt.type === 'line'
        ? (
          <button onClick={onAdvance} style={LINE_BUTTON_STYLE} type="button">
            {/* Plain `<img>`, not `next/image`: `react/forbid-component-props` forbids passing `style` to `Image`. */}
            {/* oxlint-disable-next-line next/no-img-element */}
            {portrait !== undefined && <img alt="" height={PORTRAIT_SIZE} src={portrait} style={PORTRAIT_STYLE} width={PORTRAIT_SIZE} />}
            <span style={SPEAKER_LABEL_STYLE}>{prompt.speaker}</span>
            <span style={LINE_TEXT_STYLE}>{resolveText(prompt, currentLocale)}</span>
          </button>
        )
        : <ScriptChoices choices={prompt.choices} onChoose={onChoose} />}
      {!frozen && (
        <button onClick={onDismiss} type="button">
          {CLOSE_LABEL}
        </button>
      )}
    </div>
  )
}
