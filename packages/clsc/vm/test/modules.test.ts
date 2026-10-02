import { compiled, play } from './helpers.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

test('a handler plays a cutscene and reads a Flag from a file it uses in a nested folder', async () => {
  const program = loadProgram(await compiled('modules'))
  assert.deepEqual(play(program, { on: ['interact', 'Campfire'], flags: { heard_story: true } }), [
    { type: 'line', speaker: 'Campfire', expression: 'Neutral', text: 'Again?' },
    { type: 'freeze' },
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'Once upon a time...' },
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: '...the end.' },
    { type: 'flag', name: 'heard_story', value: true },
    { type: 'unfreeze' },
    { type: 'done' },
  ])
})
