import { theme } from './theme.ts'

// Covers the whole canvas: while loading there's nothing to play yet, and after an error nothing may be played on.
export const SCREEN_STYLE = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem',
  background: theme.screenBackground,
  color: theme.text,
  font: theme.font,
  textAlign: 'center',
} as const

export const SCREEN_MESSAGE_STYLE = {
  maxWidth: '32rem',
  margin: 0,
  fontSize: '1.25rem',
} as const
