/** @jsxImportSource preact */
import type { JSX, TargetedMouseEvent } from 'preact'
import type { SlotProps } from '../slots.ts'
import { theme } from './theme.ts'
import { useCallback } from 'preact/hooks'

const DISMISS_LABEL = 'Dismiss'

// Corner-pinned so it never overlaps the bottom-centred Dialogue overlay.
const OVERLAY_STYLE = {
  position: 'absolute',
  top: '1rem',
  right: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  font: theme.font,
} as const

const BUTTON_STYLE = { font: 'inherit' } as const

export function CompanionOverlay({ companions, dismissCompanion }: SlotProps['Companions']): JSX.Element {
  const handleClick = useCallback((event: TargetedMouseEvent<HTMLButtonElement>): void => {
    const { entityId } = event.currentTarget.dataset
    if (entityId) {dismissCompanion(entityId)}
  }, [dismissCompanion])

  return (
    <div style={OVERLAY_STYLE}>
      {companions.map((entityId) => (
        <button data-entity-id={entityId} key={entityId} onClick={handleClick} style={BUTTON_STYLE} type="button">
          {`${DISMISS_LABEL} ${entityId}`}
        </button>
      ))}
    </div>
  )
}
