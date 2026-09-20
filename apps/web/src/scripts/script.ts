import type { Flags } from '../state/flags.ts'

export interface ScriptContext {
  flags: Readonly<Flags>
}

export interface Dialogue {
  lines: string[]
}

export interface ScriptBuilder {
  say: (text: string) => ScriptBuilder
  build: () => Dialogue
}

export function createScript(): ScriptBuilder {
  const lines: string[] = []
  const builder: ScriptBuilder = {

    // Dialogue choices (a `choice()` step here) land in ticket 14 — not needed for ticket 12's static line.
    say(text) {
      lines.push(text)
      return builder
    },
    build() {
      return { lines: [...lines] }
    },

  }
  return builder
}

export type Script = (ctx: ScriptContext) => Dialogue
