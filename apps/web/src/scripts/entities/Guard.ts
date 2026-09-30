import type { CutsceneTrigger, Script } from '../script.ts'

function guardScript(): CutsceneTrigger {
  return { type: 'cutscene', id: 'guard-walk' }
}

export default guardScript satisfies Script
