import type { Dialogue, Script, ScriptContext } from './script.ts'

// A failed import() means "no Script authored"; a bug thrown by an authored Script still propagates.
export async function runEntityScript(entityId: string, ctx: ScriptContext): Promise<Dialogue | undefined> {
  let script: Script
  try {
    const scriptModule = (await import(`./entities/${entityId}.ts`)) as { default: Script }
    script = scriptModule.default
  } catch {
    return undefined
  }
  return script(ctx)
}
