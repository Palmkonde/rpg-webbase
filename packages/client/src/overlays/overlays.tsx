/** @jsxImportSource preact */
import { CgOverlay } from './cg.tsx'
import { CompanionOverlay } from './companions.tsx'
import { DialogueOverlay } from './dialogue.tsx'
import { ErrorScreen } from './error-screen.tsx'
import type { HostSession } from '../session.ts'
import type { HostSnapshot } from '../views.ts'
import type { JSX } from 'preact'
import { LoadingScreen } from './loading-screen.tsx'

export function Overlays({ snapshot, session }: { snapshot: HostSnapshot; session: HostSession }): JSX.Element {
  const { status, error, cg, companions, dialogue } = snapshot
  const { advance, choose, dismissDialogue, advanceCg, skipCg, dismissCompanion } = session

  if (error) {return <ErrorScreen kind={error.kind} />}
  if (status === 'loading') {return <LoadingScreen />}

  return (
    <>
      {cg && <CgOverlay cg={cg} onAdvance={advanceCg} onSkip={skipCg} />}
      {companions.length > 0 && <CompanionOverlay companionIds={companions} onDismiss={dismissCompanion} />}
      {dialogue && <DialogueOverlay dialogue={dialogue} onAdvance={advance} onChoose={choose} onDismiss={dismissDialogue} />}
    </>
  )
}
