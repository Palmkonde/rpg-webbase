import type { CgView, ChoiceView, DialogueView } from './views.ts'
import type { GameError } from './game-error.ts'

// A dotted slot is drawn by its parent's built-in, so overriding the parent drops it (adr/0039).
export interface SlotProps {
  Loading: Record<never, never>
  ErrorScreen: { error: GameError }
  Dialogue: { dialogue: DialogueView; advance: () => void; choose: (index: number) => void; dismissDialogue: () => void }
  'Dialogue.Portrait': { speaker: string; src: string }
  Choices: { choices: readonly ChoiceView[]; choose: (index: number) => void }
  'Choices.Button': { choice: ChoiceView; index: number; choose: (index: number) => void }
  CG: { cg: CgView; advanceCg: () => void; skipCg: () => void }
  Companions: { companions: readonly string[]; dismissCompanion: (entityId: string) => void }
}

export type SlotName = keyof SlotProps

export interface SlotHandle<Props> {
  update: (props: Props) => void
  destroy: () => void
}

// Draws a slot into `element`, which the built-in parent leaves empty for it.
export type SlotRenderer<Props> = (element: HTMLElement, props: Props) => SlotHandle<Props>

// A partial of the slot map, so a misspelt slot or a renderer for the wrong props fails to typecheck.
export type SlotOverrides = { [Name in SlotName]?: SlotRenderer<SlotProps[Name]> }
