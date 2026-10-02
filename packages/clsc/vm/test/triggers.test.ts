import { compiled, play } from './helpers.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

test('interact and enter keep separate namespaces, so one id can have a handler for each', async () => {
  const program = loadProgram(await compiled('basics'), {})
  assert.deepEqual(play(program, { on: ['interact', 'Camp'] }), [
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'You talk to the camp.' },
    { type: 'done' },
  ])
  assert.deepEqual(play(program, { on: ['enter', 'Camp'] }), [
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'You walk into the camp.' },
    { type: 'done' },
  ])
})

test('start returns nothing for an id with no handler', async () => {
  const program = loadProgram(await compiled('basics'), {})
  assert.equal(program.start('enter', 'Nowhere', {}), undefined)
})

test('start returns nothing for an id whose only handler is under the other trigger', async () => {
  const program = loadProgram(await compiled('basics'), {})
  assert.equal(program.start('enter', 'Campfire', {}), undefined)
})
