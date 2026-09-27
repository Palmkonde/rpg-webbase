import type { DialogueLine } from '../scripts/script.ts'

export interface DialogueStep {
  type: 'dialogue'
  line: DialogueLine
}

export type CutsceneStep = DialogueStep

export type CutsceneRegistry = Record<string, CutsceneStep[]>

// Not in scripts/: per CONTEXT.md a Script produces a Cutscene trigger; the Cutscene's own steps live here, mirroring cg.ts's split from the Script that triggers it.
const REGISTRY = {
  'campfire-story': [
    { type: 'dialogue', line: { text: 'The fire dims, as if settling in to tell a longer story than usual.', speaker: 'Narrator', expression: 'Neutral' } },
    { type: 'dialogue', line: { text: 'Before any Student ever found this clearing, I was just a pile of cold wood.', speaker: 'Campfire' } },
    { type: 'dialogue', line: { text: '...and then someone struck the first spark, and I have been telling stories ever since.', speaker: 'Campfire', expression: 'Happy' } },
  ],
} satisfies CutsceneRegistry

export function resolveCutscene(id: string, registry: CutsceneRegistry = REGISTRY): CutsceneStep[] | undefined {
  return registry[id]
}
