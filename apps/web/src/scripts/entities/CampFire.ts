import type { Dialogue, Script, ScriptContext } from '../script.ts'
import { createScript } from '../script.ts'

// Demo content for the `CampFire` Entity authored on the main-test Map — proves the pipe end to end.
function campFireScript(ctx: ScriptContext): Dialogue {
  const metBefore = ctx.flags.talked_to_campfire
  const wasPolite = ctx.flags.was_polite_to_campfire
  const trashTalked = ctx.flags.talked_to_campfire_trash

  if (trashTalked) {
    return createScript().say('Go away!').build()
  }

  return createScript()
    .say(metBefore ? 'Huh? talk to me again?' : 'Howdy! am campfire!')
    .choice('Nice to meet you!', {
      // Two independent Flags in one outcome — contrast with "Sup man?" below, which writes only one.
      flags: { talked_to_campfire: true, was_polite_to_campfire: true },
      visible: !metBefore,
    })
    .choice('Sup man?', { flags: { talked_to_campfire: true }, visible: !metBefore })
    .choice('Ask what the campfire has seen', { visible: Boolean(wasPolite) })
    .choice('Warm your hands', {
      disabledReason: 'You need firewood first.',
      enabled: Boolean(ctx.flags.has_firewood),
    })
    .choice('What\'s this stupid campfire', { flags: { talked_to_campfire_trash: true } })
    .build()
}

export default campFireScript satisfies Script
