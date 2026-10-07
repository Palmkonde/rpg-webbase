/** @jsxImportSource preact */
import { SCREEN_MESSAGE_STYLE, SCREEN_STYLE } from './screen-style.ts'
import type { JSX } from 'preact'

// A named constant: `react/jsx-no-literals` and `jsx-curly-brace-presence` disagree on a bare JSX text literal.
const LOADING_LABEL = 'Loading…'

export function LoadingScreen(): JSX.Element {
  return (
    <div aria-busy="true" style={SCREEN_STYLE}>
      <p style={SCREEN_MESSAGE_STYLE}>{LOADING_LABEL}</p>
    </div>
  )
}
