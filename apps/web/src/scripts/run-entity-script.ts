import type { ScriptContext, ScriptResult } from './script.ts'
import { runScript } from './run-script.ts'

export function runEntityScript(entityId: string, ctx: ScriptContext): Promise<ScriptResult | undefined> {
  return runScript('entities', entityId, ctx)
}
