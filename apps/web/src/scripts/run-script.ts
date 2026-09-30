import type { Script, ScriptContext, ScriptResult } from './script.ts'

export type ScriptKind = 'entities' | 'zones'

export async function runScript(kind: ScriptKind, id: string, ctx: ScriptContext): Promise<ScriptResult | undefined> {
  let script: Script
  try {
    const scriptModule = (await import(`./${kind}/${id}.ts`)) as { default: Script }
    script = scriptModule.default
  } catch {
    return undefined
  }
  return script(ctx)
}
