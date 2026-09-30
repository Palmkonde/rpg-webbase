import type { Choice, ChoiceOptions, CutsceneTrigger, DialogueLine, SayOptions } from '../scripts/script.ts'
import type { PlayerCharId, TileCoord } from '@game-engine/engine-core'

// Pinned to engine-core's own Player charId via its type only — importing the value would pull Phaser into pure-state tests.
const PLAYER_CHAR_ID: PlayerCharId = 'player'

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

// No Cutscene-specific branching shape: reuses Choice/Choice.next? as-is (spec's "Cutscene composition").
export interface ChoiceStep {
  type: 'choice'
  choices: Choice[]
}

export type CutsceneStep = DialogueStep | MovementStep | ChoiceStep

export interface CutsceneBuilder {
  say: (text: string, options?: SayOptions) => CutsceneBuilder
  moveTo: (charId: string, targetPos: TileCoord) => CutsceneBuilder
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


// Functions for testing issues #27
function campfireEmbersBranch(): CutsceneTrigger {
  return { type: 'cutscene', id: 'campfire-story-embers' }
}

function campfireStarsBranch(): CutsceneTrigger {
  return { type: 'cutscene', id: 'campfire-story-stars' }
}

// Not in scripts/: per GLOSSARY.md a Script produces a Cutscene trigger; the Cutscene's own steps live here, mirroring cg.ts's split from the Script that triggers it.
const REGISTRY = {
  // Target tile sits north of the Campfire Entity (main_test.tmj), clear of the nearby collision wall — proves a Movement step alongside Dialogue (ticket #26).
  'campfire-story': createCutscene()
    .say('The fire dims, as if settling in to tell a longer story than usual.', { speaker: 'Narrator', expression: 'Neutral' })
    .say('Before any Student ever found this clearing, I was just a pile of cold wood.', { speaker: 'Campfire' })
    .say('...and then someone struck the first spark, and I have been telling stories ever since.', { speaker: 'Campfire', expression: 'Happy' })
    .moveTo(PLAYER_CHAR_ID, { x: 9, y: 11 })
    .say('You find yourself drawn a little closer, as if the fire pulled you in.', { speaker: 'Narrator' })

    // Proves a Choice step branches the Cutscene mid-scene (ticket #27).
    .choice('Ask about the embers', { next: campfireEmbersBranch })
    .choice('Ask about the stars overhead', { next: campfireStarsBranch })
    .build(),

  'campfire-story-embers': createCutscene()
    .say('The embers pulse like a slow heartbeat, holding the last of the warmth.', { speaker: 'Campfire' })
    .moveTo(PLAYER_CHAR_ID, {x: 2, y:2})
    .build(),

  'campfire-story-stars': createCutscene()
    .say('Look up — the same stars watched the very first fire, too.', { speaker: 'Campfire' })
    .moveTo(PLAYER_CHAR_ID, {x:10, y:2})
    .build(),
} satisfies CutsceneRegistry

export function resolveCutscene(id: string, registry: CutsceneRegistry = REGISTRY): CutsceneStep[] | undefined {
  return registry[id]
}
