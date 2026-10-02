import type { Choice, ChoiceOptions, CutsceneTrigger, DialogueLine, SayOptions } from '../scripts/script.ts'
import { PLAYER_CHAR_ID } from './player.ts'
import type { TileCoord } from '@game-engine/engine-core'
import { companionFlag } from './companions.ts'

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

  // Loop and destination tiles are clear of collision/obstacle tiles and of every Zone on main_test.tmj.
  // Ends on the Companion recruit Choice; the Guard walks back to its post first, so "Nah" leaves it there.
  'guard-walk': createCutscene()
    .say('Oh! You finally came to see me~ I\'ve been watching you ever since you arrived, you know.', { speaker: 'Guard', expression: 'Happy' })
    .say('Come, come! Walk with me. Stay close... closer~', { speaker: 'Guard', expression: 'Happy' })
    .follow(PLAYER_CHAR_ID, 'Guard')
    .moveTo('Guard', { x: 9, y: 10 })
    .moveTo('Guard', { x: 9, y: 8 })
    .moveTo('Guard', { x: 6, y: 8 })
    .moveTo('Guard', { x: 5, y: 10 })
    .say('See? We walk so well together... almost like we were made for each other.', { speaker: 'Guard', expression: 'Happy' })
    .say('Now YOU lead. I\'ll be right behind you. Always. Every single step.', { speaker: 'Guard', expression: 'Neutral' })
    .follow('Guard', PLAYER_CHAR_ID)
    .moveTo(PLAYER_CHAR_ID, { x: 8, y: 5 })
    .say('Hehe... I already memorised the way you walk. That\'s not weird. It\'s devotion~', { speaker: 'Guard', expression: 'Happy' })
    .moveTo('Guard', { x: 5, y: 11 })
    .say('I\'m supposed to stay at my post... but you wouldn\'t leave me here all alone. Would you?', { speaker: 'Guard', expression: 'Sad' })
    .choice('Follow me forever', { flags: { [companionFlag('Guard')]: 'fluffy' } })
    .choice('Nah, stay here')
    .build(),
} satisfies CutsceneRegistry

export function resolveCutscene(id: string, registry: CutsceneRegistry = REGISTRY): CutsceneStep[] | undefined {
  return registry[id]
}
