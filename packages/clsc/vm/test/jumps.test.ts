import { compiled, play } from './helpers.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

const RIDDLE = [
  { type: 'line', speaker: 'Sage', expression: 'Neutral', text: 'What walks on four legs?' },
  { type: 'choices', choices: [{ text: 'A dog' }, { text: 'A person' }] },
] as const
const MENU = { type: 'choices', choices: [{ text: 'Buy' }, { text: 'Leave' }] } as const
const SOLD = { type: 'line', speaker: 'Merchant', expression: 'Neutral', text: 'Sold.' } as const

test('the main body stops at the first section', async () => {
  const program = loadProgram(await compiled('jumps'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Gate'] }), [
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'The gate is shut.' },
    { type: 'done' },
  ])
})

test('goto jumps ahead to a section, which ends the block when it finishes', async () => {
  const program = loadProgram(await compiled('jumps'), {})
  assert.deepEqual(play(program, { on: ['interact', 'Sage'], picks: [1] }), [
    { type: 'line', speaker: 'Sage', expression: 'Neutral', text: 'Riddle me this.' },
    ...RIDDLE,
    { type: 'line', speaker: 'Sage', expression: 'Neutral', text: 'Right.' },
    { type: 'done' },
  ])
})

test('goto jumps back to a section the run already passed', async () => {
  const program = loadProgram(await compiled('jumps'), {})
  assert.deepEqual(play(program, { on: ['interact', 'Sage'], picks: [0, 1] }), [
    { type: 'line', speaker: 'Sage', expression: 'Neutral', text: 'Riddle me this.' },
    ...RIDDLE,
    { type: 'line', speaker: 'Sage', expression: 'Neutral', text: 'Wrong.' },
    ...RIDDLE,
    { type: 'line', speaker: 'Sage', expression: 'Neutral', text: 'Right.' },
    { type: 'done' },
  ])
})

test('a loop repeats a choose until a choice breaks out of it', async () => {
  const program = loadProgram(await compiled('jumps'), {})
  assert.deepEqual(play(program, { on: ['interact', 'Merchant'], picks: [0, 0, 1] }), [
    MENU,
    SOLD,
    MENU,
    SOLD,
    MENU,
    { type: 'line', speaker: 'Merchant', expression: 'Neutral', text: 'Come again.' },
    { type: 'done' },
  ])
})

test('break leaves only the innermost loop', async () => {
  const program = loadProgram(await compiled('jumps'), {})
  assert.deepEqual(
    play(program, { on: ['enter', 'Maze'] }).map((output) => (output.type === 'line' && 'text' in output ? output.text : output.type)),
    ['Inner.', 'Outer.', 'Out.', 'done'],
  )
})

test('return ends a played block, and its caller carries on below the play', async () => {
  const program = loadProgram(await compiled('jumps'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Vault'] }), [
    { type: 'freeze' },
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'Locked.' },
    { type: 'flag', name: 'seen_vault', value: true },
    { type: 'unfreeze' },
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'Back outside.' },
    { type: 'done' },
  ])
})

test('a block left by return still sets its once-only Flag', async () => {
  const program = loadProgram(await compiled('jumps'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Vault'] }).filter((output) => output.type === 'flag'), [{ type: 'flag', name: 'seen_vault', value: true }])
})
