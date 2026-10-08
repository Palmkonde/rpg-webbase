import { compiled, consoleErrors, play } from './helpers.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

const recruits = [
  { type: 'line', speaker: 'Guard', expression: 'Neutral', text: 'Take me along?' },
  { type: 'flag', name: 'companion:Guard', value: 'fluffy' },
  { type: 'done' },
]

test('a Companion never recruited reads as none, and recruiting writes its Character', async () => {
  const program = loadProgram(await compiled('companion'), {})
  assert.deepEqual(play(program, { on: ['interact', 'Guard'] }), recruits)
})

test("the Host's false for a dismissed Companion reads as none", async () => {
  const program = loadProgram(await compiled('companion'), {})
  assert.deepEqual(play(program, { on: ['interact', 'Guard'], flags: { 'companion:Guard': false } }), recruits)
})

test("a recruited Companion reads as its Character, and dismissing it writes the Host's false", async () => {
  const program = loadProgram(await compiled('companion'), {})
  assert.deepEqual(play(program, { on: ['interact', 'Guard'], flags: { 'companion:Guard': 'fluffy' } }), [
    { type: 'line', speaker: 'Guard', expression: 'Neutral', text: 'Still here.' },
    { type: 'flag', name: 'companion:Guard', value: false },
    { type: 'done' },
  ])
})

test('a Companion Flag stored as true aborts the run, naming it in a console.error', async () => {
  const program = loadProgram(await compiled('companion'), {})
  const errors = consoleErrors(() => {
    assert.deepEqual(play(program, { on: ['interact', 'Guard'], flags: { 'companion:Guard': true } }), [{ type: 'done' }])
  })
  assert.deepEqual(errors, [['Flag "companion:Guard" is stored as true, but it is declared Character?: the run is aborted']])
})

test('a Program declares the Companion Flag of each Mover, and no Flag it does not name', async () => {
  const program = loadProgram(await compiled('companion'), {})
  assert.deepEqual([program.declares('companion:Guard'), program.declares('companion:Cat'), program.declares('Guard')], [true, false, false])
})
