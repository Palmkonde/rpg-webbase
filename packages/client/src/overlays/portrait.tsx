/** @jsxImportSource preact */
import type { JSX } from 'preact'
import type { SlotProps } from '../slots.ts'

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

export function Portrait({ src }: SlotProps['Dialogue.Portrait']): JSX.Element {
  // Not a Next app, so there's no `next/image` to use.
  // oxlint-disable-next-line next/no-img-element
  return <img alt="" height={PORTRAIT_SIZE} src={src} style={PORTRAIT_STYLE} width={PORTRAIT_SIZE} />
}
