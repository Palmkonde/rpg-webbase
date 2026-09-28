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
