import type { CutsceneTrigger } from '../script.ts'

export default function campFireVis(): CutsceneTrigger {
  return { type: 'cutscene', id: 'campfire-story-step-into-zone' }
}
