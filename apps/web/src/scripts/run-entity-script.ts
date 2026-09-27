import type { Script, ScriptContext, ScriptResult } from './script.ts'

export async function runEntityScript(entityId: string, ctx: ScriptContext): Promise<ScriptResult | undefined> {
  let script: Script
  try {
    const scriptModule = (await import(`./entities/${entityId}.ts`)) as { default: Script }
    script = scriptModule.default
  } catch {
    return undefined
  }
  return script(ctx)
}
