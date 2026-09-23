import type { Flags } from '../state/flags.ts'

export interface ScriptContext {
  flags: Readonly<Flags>
}

export interface ChoiceOptions {
  flags?: Flags
  visible?: boolean
  enabled?: boolean
  disabledReason?: string
}

export interface Choice extends ChoiceOptions {
  text: string
}

export interface Dialogue {
  lines: string[]
  choices?: Choice[]
}

export interface ScriptBuilder {
  say: (text: string) => ScriptBuilder
  choice: (text: string, options?: ChoiceOptions) => ScriptBuilder
  build: () => Dialogue
}

export function createScript(): ScriptBuilder {
  const lines: string[] = []
  const choices: Choice[] = []
  const builder: ScriptBuilder = {

    say(text) {
      lines.push(text)
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
