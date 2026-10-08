import type { CgView, DialogueView } from './views.ts'
import { resolveLine, resolveText } from './strings.ts'
import type { CgFrame } from './cg.ts'
import type { CgStep } from './play-cg.ts'
import type { ScriptPrompt } from './script-player.ts'
import type { WorldContent } from './world-version.ts'
import { resolvePortrait } from './portraits.ts'

// What the Dialogue overlay shows for the Script's prompt, in the Student's Locale.
export function dialogueView(prompt: ScriptPrompt, { locale, world: { strings, portraits }, canDismiss }: { locale: string; world: WorldContent; canDismiss: boolean }): DialogueView {
  if (prompt.type === 'choices') {
    const choices = prompt.choices.map((choice) => ({
      text: resolveText(choice, locale, strings),
      locked: choice.locked && resolveText(choice.locked, locale, strings),
    }))
    return { type: 'choices', choices, canDismiss }
  }
  return {
    type: 'line',
    speaker: prompt.speaker,
    text: resolveText(prompt, locale, strings),
    portrait: resolvePortrait(prompt.speaker, prompt.expression, portraits),
    canDismiss,
  }
}

export function cgView(frames: readonly CgFrame[], step: CgStep, { locale, world: { strings } }: { locale: string; world: WorldContent }): CgView {
  const frame = frames[step.frameIndex]
  return { art: frame.art, caption: resolveLine(frame.captionKey, locale, strings), hasMore: step.hasMore }
}
