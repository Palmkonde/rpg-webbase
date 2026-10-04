'use client'

import { currentLocale, resolveLine } from '../state/strings.ts'
import type { CgFrame } from '../state/cg.ts'
import { resolveCgArt } from '../state/cg-art.ts'

const OVERLAY_STYLE = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'black',
  color: 'white',
} as const

// A real <button>, not a <div onClick>, so the click-to-advance region is keyboard-operable.
const FRAME_BUTTON_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  border: 'none',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  padding: 0,
} as const

const ART_STYLE = {
  maxWidth: '90vw',
  maxHeight: '75vh',
  objectFit: 'contain',
} as const

const CAPTION_STYLE = {
  marginTop: '1.5rem',
  fontSize: '1.25rem',
  textAlign: 'center',
  maxWidth: '32rem',
} as const

const SKIP_BUTTON_STYLE = {
  position: 'absolute',
  top: '1rem',
  right: '1rem',
  background: 'rgba(255, 255, 255, 0.15)',
  color: 'white',
  border: '1px solid white',
  borderRadius: '0.25rem',
  padding: '0.4rem 0.8rem',
} as const

// A named constant: `react/jsx-no-literals` and `jsx-curly-brace-presence` disagree on a bare JSX text literal.
const SKIP_LABEL = 'Skip'

const CUE_STYLE = {
  marginTop: '0.5rem',
  fontSize: '0.75rem',
  opacity: 0.6,
} as const

const MORE_FRAMES_CUE = '▼'

export function CgOverlay({
  frame,
  hasMore,
  onAdvance,
  onSkip,
}: {
  frame: CgFrame
  hasMore: boolean
  onAdvance: () => void
  onSkip: () => void
}): React.ReactElement {
  const art = resolveCgArt(frame.art)
  const caption = resolveLine(frame.captionKey, currentLocale)

  return (
    <div style={OVERLAY_STYLE}>
      <button onClick={onSkip} style={SKIP_BUTTON_STYLE} type="button">
        {SKIP_LABEL}
      </button>
      <button onClick={onAdvance} style={FRAME_BUTTON_STYLE} type="button">
        {/* Plain img, not next/image: this repo bans `style` on Components. */}
        {/* oxlint-disable-next-line next/no-img-element */}
        {art !== undefined && <img alt="" src={art} style={ART_STYLE} />}
        <p style={CAPTION_STYLE}>{caption}</p>
        {hasMore && <span style={CUE_STYLE}>{MORE_FRAMES_CUE}</span>}
      </button>
    </div>
  )
}
