'use client'

import { CgOverlay } from '../temp-ui/cg-overlay.tsx'
import { CompanionOverlay } from '../temp-ui/companion-overlay.tsx'
import type { HostSession } from '@codeleagues-rpg-engine/client'
import { ScriptOverlay } from '../temp-ui/script-overlay.tsx'
import { useSyncExternalStore } from 'react'

export function Overlays({ session }: { session: HostSession }): React.ReactElement {
  const { subscribe, getSnapshot, advance, choose, dismissDialogue, advanceCg, skipCg, dismissCompanion } = session
  const { cg, companions, dialogue } = useSyncExternalStore(subscribe, getSnapshot)

  return (
    <>
      {cg && <CgOverlay cg={cg} onAdvance={advanceCg} onSkip={skipCg} />}
      {companions.length > 0 && <CompanionOverlay companionIds={companions} onDismiss={dismissCompanion} />}
      {dialogue && <ScriptOverlay dialogue={dialogue} onAdvance={advance} onChoose={choose} onDismiss={dismissDialogue} />}
    </>
  )
}
