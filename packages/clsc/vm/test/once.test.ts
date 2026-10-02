import { compiled, play } from './helpers.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

test('a played CG freezes, hands back its id, then the handler carries on below the call', async () => {
  const program = loadProgram(await compiled('once'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Vision'] }), [
    { type: 'freeze' },
    { type: 'cg', id: 'vision' },
    { type: 'unfreeze' },
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'The vision fades.' },
    { type: 'done' },
  ])
})

test('a CG played inside a cutscene does not freeze again', async () => {
  const program = loadProgram(await compiled('once'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Dream'] }), [
    { type: 'freeze' },
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'A dream.' },
    { type: 'cg', id: 'vision' },
    { type: 'unfreeze' },
    { type: 'done' },
  ])
})

test('a once-only block plays once per run, as the run reads its own Flag write', async () => {
  const program = loadProgram(await compiled('once'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Story'] }), [
    { type: 'freeze' },
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'Once upon a time...' },
    { type: 'flag', name: 'seen_story', value: true },
    { type: 'unfreeze' },
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'Seen it.' },
    { type: 'done' },
  ])
})

test('a once-only CG hands back its Flag once it ends', async () => {
  const program = loadProgram(await compiled('once'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Intro'] }), [
    { type: 'freeze' },
    { type: 'cg', id: 'intro' },
    { type: 'flag', name: 'seen_intro', value: true },
    { type: 'unfreeze' },
    { type: 'done' },
  ])
})

test('play skips a once-only block whose stored Flag is already true, without freezing', async () => {
  const program = loadProgram(await compiled('once'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Intro'], flags: { seen_intro: true } }), [{ type: 'done' }])
  assert.deepEqual(play(program, { on: ['enter', 'Story'], flags: { seen_story: true } }), [
    { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'Seen it.' },
    { type: 'done' },
  ])
})

test('an aborted once-only block never hands back its Flag', async () => {
  const run = loadProgram(await compiled('once'), {}).start('enter', 'Story', {})
  assert.deepEqual(run?.next(), { type: 'freeze' })
  assert.deepEqual(run.next(), { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'Once upon a time...' })
  run.abort()
  assert.deepEqual(run.next(), { type: 'done' })
})

test('an unmarked block runs every time it is played', async () => {
  const program = loadProgram(await compiled('once'), {})
  const again = { type: 'line', speaker: 'Narrator', expression: 'Neutral', text: 'Again.' }
  assert.deepEqual(play(program, { on: ['enter', 'Helper'] }), [
    { type: 'freeze' },
    again,
    { type: 'unfreeze' },
    { type: 'freeze' },
    again,
    { type: 'unfreeze' },
    { type: 'done' },
  ])
})
