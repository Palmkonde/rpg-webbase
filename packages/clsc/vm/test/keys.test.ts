import { compiled, play } from './helpers.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

test('a keyed line, choice label and locked reason hand back their String Table keys unresolved', async () => {
  const program = loadProgram(await compiled('keys'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Camp'], picks: [0] }), [
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', key: 'campfire.greeting' },
    {
      type: 'choices',
      choices: [
        { key: 'campfire.leave' },
        { text: 'Warm up', locked: { key: 'campfire.need_firewood' } },
        { key: 'cg.intro.1', locked: { text: 'Not yet.' } },
      ],
    },
    { type: 'done' },
  ])
})
