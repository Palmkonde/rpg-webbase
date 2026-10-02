import { compiled, play } from './helpers.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

test('a played cutscene freezes once for its whole nested stack, then the handler carries on below the call', async () => {
  const program = loadProgram(await compiled('basics'), {})
  assert.deepEqual(play(program, { on: ['interact', 'Campfire'] }), [
    { type: 'line', speaker: 'Campfire', expression: 'Neutral', text: 'Want a story?' },
    { type: 'freeze' },
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'Once upon a time...' },
    { type: 'line', speaker: 'Campfire', expression: 'Sad', text: 'The embers fade.' },
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: '...and the fire still burns.' },
    { type: 'unfreeze' },
    { type: 'line', speaker: 'Campfire', expression: 'Neutral', text: 'The end.' },
    { type: 'done' },
  ])
})

test('a handler that ends on a play unfreezes before it is done', async () => {
  const program = loadProgram(await compiled('basics'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Embers'] }), [
    { type: 'freeze' },
    { type: 'line', speaker: 'Campfire', expression: 'Sad', text: 'The embers fade.' },
    { type: 'unfreeze' },
    { type: 'done' },
  ])
})

test('an empty cutscene still freezes and unfreezes', async () => {
  const program = loadProgram(await compiled('basics'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Quiet'] }), [{ type: 'freeze' }, { type: 'unfreeze' }, { type: 'done' }])
})
