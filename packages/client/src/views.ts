import type { GameError } from './game-error.ts'

export interface ChoiceView {
  text: string
  locked: string | undefined
}

// `canDismiss` is false while a Cutscene or CG has control of the Player (adr/0030).
export type DialogueView =
  | { type: 'line'; speaker: string; text: string; portrait: string | undefined; canDismiss: boolean }
  | { type: 'choices'; choices: ChoiceView[]; canDismiss: boolean }

export interface CgView {
  art: string | undefined
  caption: string
  hasMore: boolean
}

export interface HostSnapshot {
  status: 'loading' | 'playing' | 'error'
  dialogue: DialogueView | undefined
  cg: CgView | undefined

  // Empty while the Engine is paused, so a dismiss can't cut off a Cutscene's Movement step (adr/0028).
  companions: readonly string[]
  error: GameError | undefined
}
