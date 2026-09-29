import type { CgTrigger, CutsceneTrigger, Dialogue, Script, ScriptContext } from '../script.ts'
import { currentLocale, resolveLine } from '../../state/strings.ts'
import { createScript } from '../script.ts'

const SPEAKER = 'Campfire'

function campFireStory(): CutsceneTrigger {
  return { type: 'cutscene', id: 'campfire-story' }
}

// Branches between Dialogue and a CG by Flag, same as campFireScript already does for Dialogue variations.
function campFireVision(ctx: ScriptContext): Dialogue | CgTrigger {
  if (!ctx.flags.was_polite_to_campfire) {
    return createScript(SPEAKER).say('The flames don\'t stir for someone who was rude to them.').build()
  }
  return { type: 'cg', id: 'campfire-vision' }
}

// Both campFireMemories branches reconverge here via the same closure — no dedicated merge-point primitive needed (spec's "Branch reconvergence").
function campFireMemoryEnding(): Dialogue {
  return createScript(SPEAKER).say('...they moved on, same as you will.', { expression: 'Sad' }).build()
}

// A second round nested under "Ask what the campfire has seen" — proves a choice's outcome can offer another round of choices, and stages a narrator line (no Entity) alongside the campfire's own default-attributed line.
// The Expression changes line-to-line within this single round (not just when the Speaker does), proving Portrait resolution is per-line, not per-round.
function campFireMemories(): Dialogue {
  return createScript(SPEAKER)
    .say('The fire dims for a moment, as if remembering something older than words.', { speaker: 'Narrator', expression: 'Sad' })
    .say('I remember the first Student who ever spoke to me.', { expression: 'Neutral' })
    .choice('Ask what happened to them', { next: campFireMemoryEnding })
    .choice('Never mind', { next: campFireMemoryEnding })
    .build()
}

// Demo content for the `CampFire` Entity authored on the main-test Map — proves the pipe end to end.
function campFireScript(ctx: ScriptContext): Dialogue {
  const metBefore = ctx.flags.talked_to_campfire
  const wasPolite = ctx.flags.was_polite_to_campfire
  const trashTalked = ctx.flags.talked_to_campfire_trash

  if (trashTalked) {
    // 'Angry' has no registered Portrait for Campfire (docs/guides/dialogue-portrait-assets.md) — proves the text-only fallback renders with no warning.
    return createScript(SPEAKER).say('Go away!', { expression: 'Angry' }).build()
  }

  return createScript(SPEAKER)
    // Resolved through the string table (ticket 19), not an inline literal like the other lines here — proves the mechanism end-to-end.
    .say(resolveLine(metBefore ? 'campfire.greeting_returning' : 'campfire.greeting', currentLocale), {
      expression: metBefore ? 'Neutral' : 'Happy',
    })
    .choice('Nice to meet you!', {
      // Two independent Flags in one outcome — contrast with "Sup man?" below, which writes only one.
      flags: { talked_to_campfire: true, was_polite_to_campfire: true },
      visible: !metBefore,
    })
    .choice('Sup man?', { flags: { talked_to_campfire: true }, visible: !metBefore })
    .choice('Ask what the campfire has seen', { next: campFireMemories, visible: Boolean(wasPolite) })
    .choice('Ask for a story', { next: campFireStory })
    .choice('Ask Campfire to show CG again', { next: campFireVision })
    .choice('Warm your hands', {
      disabledReason: 'You need firewood first.',
      enabled: Boolean(ctx.flags.has_firewood),
    })
    .choice('What\'s this stupid campfire', { flags: { talked_to_campfire_trash: true } })
    .build()
}

export default campFireScript satisfies Script
