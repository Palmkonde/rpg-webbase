'use client'

import type { Choice, Dialogue, DialogueLine } from '../scripts/script.ts'
import { useCallback, useState } from 'react'
import { resolvePortrait } from '../state/portraits.ts'

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

// The clickable line region is a real <button>, not a <div onClick>, so it's keyboard-operable (Enter/Space) for free — `jsx-a11y` requires an interactive element here, not a manually-built one.
const LINE_BUTTON_STYLE = {
  display: 'block',
  width: '100%',
  margin: '0 0 0.75rem',
  padding: 0,
  paddingRight: '1.5rem',
  paddingBottom: '1.25rem',
  border: 'none',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  position: 'relative',
} as const

// Once there's no next line, the button is `disabled` (per spec: box clicks do nothing further) — just a cursor change from LINE_BUTTON_STYLE.
const LINE_BUTTON_DONE_STYLE = {
  ...LINE_BUTTON_STYLE,
  cursor: 'default',
} as const

// Display size only — how big art is drawn/exported is out of this ticket's scope, per spec's "Dialogue Portraits & Expressions" Out of Scope.
const PORTRAIT_SIZE = 64

// `float`, not a flex wrapper `<div>`, to stay phrasing content inside the `<button>` (see the `<span>`-not-`<p>` note below).
const PORTRAIT_STYLE = {
  float: 'left',
  width: `${PORTRAIT_SIZE}px`,
  height: `${PORTRAIT_SIZE}px`,
  marginRight: '0.75rem',
  borderRadius: '0.25rem',
  objectFit: 'cover',
} as const

// `<span>`, not `<p>`, since `<button>`'s content model only allows phrasing content — `display: block` recreates the paragraph-like stacking.
const SPEAKER_LABEL_STYLE = {
  display: 'block',
  margin: '0 0 0.15rem',
  fontWeight: 'bold',
} as const

const LINE_TEXT_STYLE = {
  display: 'block',
  margin: 0,
} as const

const SPEAKER_LINE_TEXT_STYLE = {
  display: 'block',
  margin: 0,
  marginLeft: '1rem',
} as const

const CUE_STYLE = {
  position: 'absolute',
  right: '0.25rem',
  bottom: '0.1rem',
  fontSize: '0.75rem',
  opacity: 0.6,
} as const

// A named constant, not an inline literal — same `jsx-no-literals`/`jsx-curly-brace-presence` reasoning as `CLOSE_LABEL` below.
const MORE_LINES_CUE = '▼'

// A named constant, not an inline literal: `react/jsx-no-literals` and `jsx-curly-brace-presence` disagree on how a bare JSX text literal should look, and referencing a variable satisfies both.
const CLOSE_LABEL = 'Close'

// Extracted out of DialogueOverlay to stay under oxlint's max-statements limit — also gives line-by-line reveal one clear owner, independent of choice-click feedback (`blockedReason`).
function usePaginatedLines(dialogue: Dialogue): {
  currentLine: DialogueLine | undefined
  hasMoreLines: boolean
  advance: () => void
} {
  const [index, setIndex] = useState(0)

  // Resetting state during render (not an Effect) on prop identity change: react.dev's documented pattern for "adjusting state when a prop changes" — avoids the extra committed frame an Effect-based reset would flash.
  const [previousDialogue, setPreviousDialogue] = useState(dialogue)
  if (dialogue !== previousDialogue) {
    setPreviousDialogue(dialogue)
    setIndex(0)
  }

  const advance = useCallback((): void => {
    setIndex((current) => current + 1)
  }, [])

  return { currentLine: dialogue.lines[index], hasMoreLines: index < dialogue.lines.length - 1, advance }
}

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
  const { currentLine, hasMoreLines, advance } = usePaginatedLines(dialogue)
  const portrait = resolvePortrait(currentLine?.speaker, currentLine?.expression)

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
      {currentLine && (
        <button
          disabled={!hasMoreLines}
          onClick={advance}
          style={hasMoreLines ? LINE_BUTTON_STYLE : LINE_BUTTON_DONE_STYLE}
          type="button"
        >
          {/* Plain `<img>`, not `next/image`: a 64px dialogue thumbnail has no LCP stake, and this repo's
              `react/forbid-component-props` rule forbids passing `style` to a Component like `next/image`'s `Image`. */}
          {/* oxlint-disable-next-line next/no-img-element */}
          {portrait !== undefined && <img alt="" height={PORTRAIT_SIZE} src={portrait} style={PORTRAIT_STYLE} width={PORTRAIT_SIZE} />}
          {currentLine.speaker !== undefined && <span style={SPEAKER_LABEL_STYLE}>{currentLine.speaker}</span>}
          <span style={currentLine.speaker === undefined ? LINE_TEXT_STYLE : SPEAKER_LINE_TEXT_STYLE}>
            {currentLine.text}
          </span>
          {hasMoreLines && <span style={CUE_STYLE}>{MORE_LINES_CUE}</span>}
        </button>
      )}
      {/* Choices only once the round's last line is showing — `visible`/`enabled` filtering unchanged from ticket 16. */}
      {!hasMoreLines && visibleChoices?.map(({ choice, index }) => {
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
