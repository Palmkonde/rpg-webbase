import type { Flags, Output, Program, Run, Trigger } from '../src/program.ts'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// A fresh copy each call, so a test can patch a compiled header rather than hand-write bytecode. `bun run test` compiles each `fixtures/<name>/` scripts root into `generated/<name>.clscb`.
export async function compiled(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(new URL(`generated/${name}.clscb`, import.meta.url)))
}

export interface PlayOptions {
  on: [Trigger, string]
  flags?: Flags
  picks?: readonly number[]
}

// Runs `body` with console.error captured, and returns the arguments of each call. Swapped by hand rather than through a runner's mock, so it runs under both `bun test` and `node --test`; the finally matters because `bun test` shares one process across files.
export function consoleErrors(body: () => void): unknown[][] {
  const errors: unknown[][] = []
  const original = console.error
  console.error = (...args: unknown[]): void => { errors.push(args) }
  try {
    body()
  } finally {
    console.error = original
  }
  return errors
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
