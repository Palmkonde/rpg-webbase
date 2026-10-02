import type { Choice, ChoiceOptions, DialogueLine, SayOptions } from '../scripts/script.ts'
import type { TileCoord } from '@game-engine/engine-core'

const DEFAULT_FOLLOW_GAP = 0

export interface DialogueStep {
  type: 'dialogue'
  line: DialogueLine
}

// Wraps grid-engine's one-shot moveTo(charId, targetPos) (adr/0017).
export interface MovementStep {
  type: 'movement'
  charId: string
  targetPos: TileCoord
}

export interface FollowStep {
  type: 'follow'
  followerId: string
  leaderId: string
  gap: number
}

export interface FollowOptions {
  // Empty tiles kept between follower and leader.
  gap?: number
}

// No Cutscene-specific branching shape: reuses Choice/Choice.next? as-is (spec's "Cutscene composition").
export interface ChoiceStep {
  type: 'choice'
  choices: Choice[]
}

export type CutsceneStep = DialogueStep | MovementStep | FollowStep | ChoiceStep

export interface CutsceneBuilder {
  say: (text: string, options?: SayOptions) => CutsceneBuilder
  moveTo: (charId: string, targetPos: TileCoord) => CutsceneBuilder
  follow: (followerId: string, leaderId: string, options?: FollowOptions) => CutsceneBuilder
  choice: (text: string, options?: ChoiceOptions) => CutsceneBuilder
  build: () => CutsceneStep[]
}

// Cutscene's own step-list builder — ScriptBuilder (scripts/script.ts) stays Dialogue-only per adr/0018.
export function createCutscene(): CutsceneBuilder {
  const steps: CutsceneStep[] = []
  const builder: CutsceneBuilder = {
    say(text, options) {
      steps.push({ type: 'dialogue', line: { text, ...options } })
      return builder
    },
    moveTo(charId, targetPos) {
      steps.push({ type: 'movement', charId, targetPos })
      return builder
    },
    follow(followerId, leaderId, { gap = DEFAULT_FOLLOW_GAP } = {}) {
      steps.push({ type: 'follow', followerId, leaderId, gap })
      return builder
    },
    choice(text, options) {
      const newChoice: Choice = { text, ...options }
      const last = steps.at(-1)

      // Replaces, not mutates: an earlier build() call may already hold a reference to the previous ChoiceStep.
      if (last?.type === 'choice') {
        steps[steps.length - 1] = { type: 'choice', choices: [...last.choices, newChoice] }
      } else {
        steps.push({ type: 'choice', choices: [newChoice] })
      }
      return builder
    },
    build() {
      return [...steps]
    },
  }
  return builder
}

export type CutsceneRegistry = Record<string, CutsceneStep[]>

// Not in scripts/: per GLOSSARY.md a Script produces a Cutscene trigger; the Cutscene's own steps live here, mirroring cg.ts's split from the Script that triggers it.
// Kept, empty, until the TS Script path is removed.
const REGISTRY: CutsceneRegistry = {}

export function resolveCutscene(id: string, registry: CutsceneRegistry = REGISTRY): CutsceneStep[] | undefined {
  return registry[id]
}
