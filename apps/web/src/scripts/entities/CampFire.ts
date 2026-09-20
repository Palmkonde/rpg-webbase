import type { Dialogue, Script, ScriptContext } from '../script.ts'
import { createScript } from '../script.ts'

// Demo content for the `CampFire` Entity authored on the main-test Map — proves the pipe end to end.
function campFireScript(ctx: ScriptContext): Dialogue {
  const alreadyTalked = ctx.flags.talked_to_campfire

  if (alreadyTalked) {
    return createScript().say("Huh? talk to me again?").build()
  }

  return createScript().say('Howdy! am campfire!').say('how do you do?').build()
}

export default campFireScript satisfies Script
