import { compiled, play } from './helpers.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

// The VM only checks a handler exists; the Host is the one that calls it.
function ignore(): undefined {
  return undefined
}

const handlers = { move: ignore, follow: ignore }

test('a cutscene hands back each command with its arguments and whether it waits, carrying on at next()', async () => {
  const program = loadProgram(await compiled('commands'), handlers)
  assert.deepEqual(play(program, { on: ['interact', 'Guard'] }), [
    { type: 'line', speaker: 'Guard', expression: 'Neutral', text: 'Walk with me.' },
    { type: 'freeze' },
    { type: 'command', name: 'follow', args: ['Player', 'Guard'], waits: false },
    { type: 'command', name: 'move', args: ['Guard', { x: 9, y: 10 }], waits: true },
    { type: 'line', speaker: 'Guard', expression: 'Happy', text: 'Here we are.' },
    { type: 'unfreeze' },
    { type: 'done' },
  ])
})

test('loading fails when a command the prelude declares has no Host handler, naming it', async () => {
  const bytes = await compiled('commands')
  assert.throws(() => loadProgram(bytes, { move: ignore }), {
    message: 'The prelude declares the command "follow", but the Host has no handler for it',
  })
})
