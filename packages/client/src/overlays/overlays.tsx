/** @jsxImportSource preact */
import { CgOverlay } from './cg.tsx'
import { CompanionOverlay } from './companions.tsx'
import { DialogueOverlay } from './dialogue.tsx'
import { ErrorScreen } from './error-screen.tsx'
import type { HostSession } from '../session.ts'
import type { HostSnapshot } from '../views.ts'
import type { JSX } from 'preact'
import { LoadingScreen } from './loading-screen.tsx'
import { Slot } from './slot.tsx'

export function Overlays({ snapshot, session }: { snapshot: HostSnapshot; session: HostSession }): JSX.Element {
  const { status, error, cg, companions, dialogue } = snapshot
  const { advance, choose, dismissDialogue, advanceCg, skipCg, dismissCompanion } = session

  if (error) {return <Slot builtIn={ErrorScreen} error={error} name="ErrorScreen" />}
  if (status === 'loading') {return <Slot builtIn={LoadingScreen} name="Loading" />}

  return (
    <>
      {cg && <Slot advanceCg={advanceCg} builtIn={CgOverlay} cg={cg} name="CG" skipCg={skipCg} />}
      {companions.length > 0 && <Slot builtIn={CompanionOverlay} companions={companions} dismissCompanion={dismissCompanion} name="Companions" />}
      {dialogue && <Slot advance={advance} builtIn={DialogueOverlay} choose={choose} dialogue={dialogue} dismissDialogue={dismissDialogue} name="Dialogue" />}
    </>
  )
}
