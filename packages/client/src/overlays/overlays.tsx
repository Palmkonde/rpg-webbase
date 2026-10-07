/** @jsxImportSource preact */
import type { HostSession, HostSnapshot } from '../session.ts'
import { CgOverlay } from './cg.tsx'
import { CompanionOverlay } from './companions.tsx'
import { DialogueOverlay } from './dialogue.tsx'
import type { JSX } from 'preact'

export function Overlays({ snapshot, session }: { snapshot: HostSnapshot; session: HostSession }): JSX.Element {
  const { cg, companions, dialogue } = snapshot
  const { advance, choose, dismissDialogue, advanceCg, skipCg, dismissCompanion } = session

  return (
    <>
      {cg && <CgOverlay cg={cg} onAdvance={advanceCg} onSkip={skipCg} />}
      {companions.length > 0 && <CompanionOverlay companionIds={companions} onDismiss={dismissCompanion} />}
      {dialogue && <DialogueOverlay dialogue={dialogue} onAdvance={advance} onChoose={choose} onDismiss={dismissDialogue} />}
    </>
  )
}
