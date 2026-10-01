import type { Flags, Output, Program, Trigger } from '../src/program.ts'
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

// Drives one run to `done`, calling next() after every output, and returns every output in order.
export function play(program: Program, { on: [trigger, id], flags = {} }: PlayOptions): Output[] {
  const run = program.start(trigger, id, flags)
  assert.ok(run, `no handler for on ${trigger}(${id})`)

  const outputs: Output[] = []
  let output: Output
  do {
    output = run.next()
    outputs.push(output)
  } while (output.type !== 'done')
  return outputs
}
