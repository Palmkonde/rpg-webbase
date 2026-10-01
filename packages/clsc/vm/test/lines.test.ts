import { compiled, play } from './helpers.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

test('a handler hands back its lines in order, Neutral when no Expression is written, then done', async () => {
  const program = loadProgram(await compiled('basics'))
  assert.deepEqual(play(program, { on: ['enter', 'Lines'] }), [
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'The fire crackles.' },
    { type: 'line', speaker: 'Campfire', expression: 'Happy', text: 'สวัสดี!  Two spaces, a "quote", a \\ and // not a comment.' },
    { type: 'done' },
  ])
})
