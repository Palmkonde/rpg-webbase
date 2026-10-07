'use client'

import { useCallback } from 'react'

const DISMISS_LABEL = 'Dismiss'

// Corner-pinned so it never overlaps the bottom-centred Script overlay.
const OVERLAY_STYLE = {
  position: 'fixed',
  top: '1rem',
  right: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
} as const

export function CompanionOverlay({
  companionIds,
  onDismiss,
}: {
  companionIds: readonly string[]
  onDismiss: (entityId: string) => void
}): React.ReactElement {
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
    const { entityId } = event.currentTarget.dataset
    if (entityId) {onDismiss(entityId)}
  }, [onDismiss])

  return (
    <div style={OVERLAY_STYLE}>
      {companionIds.map((entityId) => (
        <button data-entity-id={entityId} key={entityId} onClick={handleClick} type="button">
          {`${DISMISS_LABEL} ${entityId}`}
        </button>
      ))}
    </div>
  )
}
