import type { CutsceneTrigger, Script } from '../script.ts'

// Demo content for the `Guard` Character Entity authored on the main-test Map — triggers a Cutscene that walks it (ticket #34).
function guardScript(): CutsceneTrigger {
  return { type: 'cutscene', id: 'guard-walk' }
}

export default guardScript satisfies Script
