import type { Flags } from '../state/flags.ts'

export interface ScriptContext {
  flags: Readonly<Flags>
}

export interface Choice {
  text: string
  flag?: string
}

export interface Dialogue {
  lines: string[]
  choices?: Choice[]
}

export interface ScriptBuilder {
  say: (text: string) => ScriptBuilder
  choice: (text: string, flag?: string) => ScriptBuilder
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
    // No flag ⇒ a no-op choice that just ends the round without a Flag write.
    choice(text, flag) {
      choices.push(flag === undefined ? { text } : { text, flag })
      return builder
    },
    build() {
      return { lines: [...lines], ...(choices.length > 0 ? { choices: [...choices] } : {}) }
    },

  }
  return builder
}

export type Script = (ctx: ScriptContext) => Dialogue
