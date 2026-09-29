import assert from 'node:assert/strict'
import { createCutscene } from '../src/state/cutscene.ts'
import { test } from 'node:test'

test('createCutscene with no steps builds an empty step list', () => {
  assert.deepEqual(createCutscene().build(), [])
})

test('createCutscene say() builds a Dialogue step', () => {
  const steps = createCutscene().say('Hello.').build()
  assert.deepEqual(steps, [{ type: 'dialogue', line: { text: 'Hello.' } }])
})

test('createCutscene say() carries speaker/expression onto the Dialogue step\'s line', () => {
  const steps = createCutscene().say('Howdy!', { speaker: 'Campfire', expression: 'Happy' }).build()
  assert.deepEqual(steps, [{ type: 'dialogue', line: { text: 'Howdy!', speaker: 'Campfire', expression: 'Happy' } }])
})

test('createCutscene moveTo() builds a Movement step targeting the given charId/position', () => {
  const steps = createCutscene().moveTo('player', { x: 3, y: 4 }).build()
  assert.deepEqual(steps, [{ type: 'movement', charId: 'player', targetPos: { x: 3, y: 4 } }])
})

test('createCutscene chains say() and moveTo() into one ordered step list', () => {
  const steps = createCutscene()
    .say('Come here.', { speaker: 'Campfire' })
    .moveTo('player', { x: 9, y: 11 })
    .say('Good.', { speaker: 'Campfire' })
    .build()

  assert.deepEqual(steps, [
    { type: 'dialogue', line: { text: 'Come here.', speaker: 'Campfire' } },
    { type: 'movement', charId: 'player', targetPos: { x: 9, y: 11 } },
    { type: 'dialogue', line: { text: 'Good.', speaker: 'Campfire' } },
  ])
})

test('createCutscene moveTo() accepts any charId string, not just the Player\'s', () => {
  const steps = createCutscene().moveTo('CampFire', { x: 8, y: 13 }).build()
  assert.deepEqual(steps, [{ type: 'movement', charId: 'CampFire', targetPos: { x: 8, y: 13 } }])
})

test('createCutscene choice() builds a Choice step with one Choice', () => {
  const steps = createCutscene().choice('Ask about the embers').build()
  assert.deepEqual(steps, [{ type: 'choice', choices: [{ text: 'Ask about the embers' }] }])
})

test('createCutscene consecutive choice() calls group into one Choice step', () => {
  const steps = createCutscene()
    .choice('Ask about the embers')
    .choice('Ask about the stars overhead')
    .build()

  assert.deepEqual(steps, [
    { type: 'choice', choices: [{ text: 'Ask about the embers' }, { text: 'Ask about the stars overhead' }] },
  ])
})

test('createCutscene choice() after say() starts a new Choice step', () => {
  const steps = createCutscene()
    .say('Well?')
    .choice('Yes')
    .choice('No')
    .say('Understood.')
    .build()

  assert.deepEqual(steps, [
    { type: 'dialogue', line: { text: 'Well?' } },
    { type: 'choice', choices: [{ text: 'Yes' }, { text: 'No' }] },
    { type: 'dialogue', line: { text: 'Understood.' } },
  ])
})

test('createCutscene choice() carries ChoiceOptions onto the Choice', () => {
  const steps = createCutscene().choice('Ask', { flags: { asked: true }, visible: false }).build()
  assert.deepEqual(steps, [{ type: 'choice', choices: [{ text: 'Ask', flags: { asked: true }, visible: false }] }])
})

test('createCutscene build() output is unaffected by a later choice() call', () => {
  const builder = createCutscene().choice('First')
  const before = builder.build()
  builder.choice('Second')
  assert.deepEqual(before, [{ type: 'choice', choices: [{ text: 'First' }] }])
})
