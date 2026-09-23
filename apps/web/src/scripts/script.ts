import type { Flags } from '../state/flags.ts'

export interface ScriptContext {
  flags: Readonly<Flags>
}

export type Expression = 'Neutral' | 'Happy' | 'Sad' | 'Angry' | 'Surprised'

export interface SayOptions {
  speaker?: string
  expression?: Expression
}

export interface DialogueLine extends SayOptions {
  text: string
}

export interface ChoiceOptions {
  flags?: Flags
  visible?: boolean
  enabled?: boolean
  disabledReason?: string

  //  Adding to script dialogue
  next?: Script
}

export interface Choice extends ChoiceOptions {
  text: string
}

export interface Dialogue {
  lines: DialogueLine[]
  choices?: Choice[]
}

export interface ScriptBuilder {
  say: (text: string, options?: SayOptions) => ScriptBuilder
  choice: (text: string, options?: ChoiceOptions) => ScriptBuilder
  build: () => Dialogue
}

// `defaultSpeaker` is the owning Entity's display name — a Script author supplies it once (see entities/CampFire.ts) since nothing else in the Host/Engine boundary carries it (Tiled's `name` field is an authoring label, not Player-facing text).
export function createScript(defaultSpeaker?: string): ScriptBuilder {
  const lines: DialogueLine[] = []
  const choices: Choice[] = []
  const builder: ScriptBuilder = {

    say(text, options) {
      const speaker = options?.speaker ?? defaultSpeaker
      const expression = options?.expression
      lines.push({
        text,
        ...(speaker === undefined ? {} : { speaker }),
        ...(expression === undefined ? {} : { expression }),
      })
      return builder
    },
    choice(text, options) {
      choices.push({ text, ...options })
      return builder
    },
    build() {
      return { lines: [...lines], ...(choices.length > 0 ? { choices: [...choices] } : {}) }
    },

  }
  return builder
}

export type Script = (ctx: ScriptContext) => Dialogue
