import type { Dialogue, Script, ScriptContext } from '../script.ts'
import { createScript } from '../script.ts'

// Demo content for the `CampFire` Entity authored on the main-test Map — proves the pipe end to end.
function campFireScript(ctx: ScriptContext): Dialogue {
  const alreadyTalked = ctx.flags.talked_to_campfire
  const alreadyTrashTalked = ctx.flags.talked_to_campfire_trash

  if (alreadyTalked) {
    return createScript().say("Huh? talk to me again?").build()
  }
  if (alreadyTrashTalked) {
    return createScript().say('Go away!').build()
  }

  return createScript()
    .say('Howdy! am campfire!')
    .say('how do you do?')
    .choice('Nice to meet you!', 'talked_to_campfire')
    .choice('Sup man?', 'talked_to_campfire')
    .choice('What\'s this stupid campfire', 'talked_to_campfire_trash')
    .build()
}

export default campFireScript satisfies Script
