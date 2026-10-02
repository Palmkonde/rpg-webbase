import { compiled, play } from './helpers.ts'
import assert from 'node:assert/strict'
import { loadProgram } from '../src/program.ts'
import { test } from 'node:test'

const FIRST_TALK = { type: 'choices', choices: [{ text: 'Nice to meet you!' }, { text: 'Warm your hands', locked: 'You need firewood first.' }, { text: 'Leave' }] } as const
const BYE = { type: 'line', speaker: 'Campfire', expression: 'Neutral', text: 'Bye.' } as const

test('a choice whose condition is false is hidden, unless it has a locked reason to show', async () => {
  const run = loadProgram(await compiled('flags'), {}).start('interact', 'Campfire', {})
  assert.deepEqual(run?.next(), FIRST_TALK)
})

test('choose(i) indexes into the choices shown, which leave out the hidden ones', async () => {
  const program = loadProgram(await compiled('flags'), {})
  const flags = { talked: true, polite: true, has_firewood: true }
  assert.deepEqual(play(program, { on: ['interact', 'Campfire'], flags, picks: [1] }).slice(1, 2), [
    { type: 'line', speaker: 'Campfire', expression: 'Happy', text: 'Ahh, warm.' },
  ])
})

test('after a choice body, execution continues below the choose', async () => {
  const program = loadProgram(await compiled('flags'), {})
  assert.deepEqual(play(program, { on: ['interact', 'Campfire'], picks: [0] }), [
    FIRST_TALK,
    { type: 'flag', name: 'talked', value: true },
    { type: 'flag', name: 'polite', value: true },
    BYE,
    { type: 'done' },
  ])
})

test('a bare choice does nothing', async () => {
  const program = loadProgram(await compiled('flags'), {})
  assert.deepEqual(play(program, { on: ['interact', 'Campfire'], picks: [2] }), [FIRST_TALK, BYE, { type: 'done' }])
})

test('a choose nests inside a choice body, and each returns below itself', async () => {
  const program = loadProgram(await compiled('flags'), {})
  const flags = { talked: true, polite: true, has_firewood: true }
  assert.deepEqual(play(program, { on: ['interact', 'Campfire'], flags, picks: [0, 1] }), [
    { type: 'choices', choices: [{ text: 'Ask what the campfire has seen' }, { text: 'Warm your hands' }, { text: 'Leave' }] },
    { type: 'line', speaker: 'Campfire', expression: 'Sad', text: 'I remember the first Student.' },
    { type: 'choices', choices: [{ text: 'Ask what happened to them' }, { text: 'Never mind' }] },
    { type: 'line', speaker: 'Campfire', expression: 'Neutral', text: '...they moved on.' },
    BYE,
    { type: 'done' },
  ])
})

test('a choose whose every choice is hidden is skipped', async () => {
  const program = loadProgram(await compiled('flags'), {})
  assert.deepEqual(play(program, { on: ['enter', 'Hidden'] }), [
    { type: 'line', speaker: 'Campfire', expression: 'Neutral', text: 'Nothing to choose.' },
    { type: 'done' },
  ])
})

test('choose(i) refuses a locked choice', async () => {
  const run = loadProgram(await compiled('flags'), {}).start('interact', 'Campfire', {})
  assert.deepEqual(run?.next(), FIRST_TALK)
  assert.throws(() => run.choose(1), { message: 'choose(1) is not a shown, unlocked choice' })
})

test('next() refuses to run on while choices wait for choose(i)', async () => {
  const run = loadProgram(await compiled('flags'), {}).start('interact', 'Campfire', {})
  assert.deepEqual(run?.next(), FIRST_TALK)
  assert.throws(() => run.next(), { message: 'The run is waiting for choose(i), not next()' })
})
