import { compiled, play } from './helpers.ts'
import type { Program } from '../src/program.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

function narrated(...texts: string[]): unknown[] {
  return [...texts.map((text) => ({ type: 'line', speaker: 'Narrator', expression: 'Neutral', text })), { type: 'done' }]
}

function greeting(program: Program, flags: Record<string, boolean>): unknown {
  return play(program, { on: ['enter', 'Greeting'], flags })[0]
}

test('if / else if / else runs the first branch whose condition holds', async () => {
  const program = loadProgram(await compiled('flags'), {})
  assert.deepEqual(greeting(program, { talked: true, polite: false }), { type: 'line', speaker: 'Campfire', expression: 'Angry', text: 'Go away!' })
  assert.deepEqual(greeting(program, { talked: true, polite: true }), { type: 'line', speaker: 'Campfire', expression: 'Neutral', text: 'Welcome back.' })
  assert.deepEqual(greeting(program, {}), { type: 'line', speaker: 'Campfire', expression: 'Happy', text: 'Hello, stranger.' })
})

test('!, &&, ||, ==, != and parentheses evaluate with && binding tighter than ||', async () => {
  const program = loadProgram(await compiled('flags'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Logic'] }), narrated('a', 'b', 'c'))
  assert.deepEqual(play(program, { on: ['enter', 'Logic'], flags: { talked: true, polite: true } }), narrated('b'))
})

test('a declared Flag missing from the snapshot reads as its default', async () => {
  const program = loadProgram(await compiled('flags'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Lit'] }), narrated('Lit by default.'))
})

test('a run reads its own writes after handing each one back', async () => {
  const program = loadProgram(await compiled('flags'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Writes'], flags: { talked: false } }), [
    { type: 'flag', name: 'talked', value: true },
    ...narrated('The run reads its own write.'),
  ])
})

test('a stored Flag of the wrong type aborts the run before any output, naming it in a console.error', async (context) => {
  const errors: unknown[][] = []
  context.mock.method(console, 'error', (...args: unknown[]) => { errors.push(args) })
  const program = loadProgram(await compiled('flags'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Lit'], flags: { lit: 'yes' } }), [{ type: 'done' }])
  assert.deepEqual(errors, [['Flag "lit" is stored as "yes", but it is declared bool: the run is aborted']])
})

test('an undeclared stored Flag is invisible, whatever its type', async () => {
  const program = loadProgram(await compiled('flags'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Lit'], flags: { campfire_seen: 3 } }), narrated('Lit by default.'))
})

test('abort() ends a run, after the Flags already handed back', async () => {
  const run = loadProgram(await compiled('flags'), {}).start('enter', 'Writes', {})
  assert.deepEqual(run?.next(), { type: 'flag', name: 'talked', value: true })
  run.abort()
  assert.deepEqual(run.next(), { type: 'done' })
})

test('a declared Flag named like an Object property still reads as its default when missing', async () => {
  const program = loadProgram(await compiled('flags'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Inherited'] }), narrated('constructor is false by default.'))
})
