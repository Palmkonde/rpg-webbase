import type { Flags, Output, Program, Run, Trigger } from '../src/program.ts'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// A fresh copy each call, so a test can patch a compiled header rather than hand-write bytecode. `npm test` compiles each `fixtures/<name>/` scripts root into `generated/<name>.clscb`.
export async function compiled(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(new URL(`generated/${name}.clscb`, import.meta.url)))
}

export interface PlayOptions {
  on: [Trigger, string]
  flags?: Flags
  picks?: readonly number[]
}

// Answers a `choices` with the next of `picks`, which it consumes, and anything else with next().
function answer(run: Run, previous: Output | undefined, picks: number[]): Output {
  if (previous?.type !== 'choices') {return run.next()}
  const pick = picks.shift()
  assert.ok(pick !== undefined, 'the run offered more choices than there are picks')
  return run.choose(pick)
}

// Drives one run to `done` and returns every output in order.
export function play(program: Program, { on: [trigger, id], flags = {}, picks = [] }: PlayOptions): Output[] {
  const run = program.start(trigger, id, flags)
  assert.ok(run, `no handler for on ${trigger}(${id})`)

  const remaining = [...picks]
  const outputs: Output[] = []
  let output: Output
  do {
    output = answer(run, outputs.at(-1), remaining)
    outputs.push(output)
  } while (output.type !== 'done')
  return outputs
}
