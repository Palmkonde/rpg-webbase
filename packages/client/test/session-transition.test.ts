import { settle, startSession } from './helpers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const TO_SCHOOL = { type: 'transitioned', fromMapId: 'town', toMapId: 'school', spawn: { x: 5, y: 1 } } as const

test('a Transition destroys the Engine and starts one on the target Map at the Spawn Point, as the same Character', async () => {
  const { engine } = await startSession()

  engine.emit(TO_SCHOOL)
  await settle()

  assert.ok(engine.calls.includes('destroy'))
  assert.deepEqual(engine.created?.worldConfig, { mapId: 'school', player: { spawn: { x: 5, y: 1 }, characterId: 'fluffy' } })
})

test('a Transition ends the Dialogue on screen', async () => {
  const { session, engine } = await startSession()
  engine.emit({ type: 'interacted', entityId: 'Sage' })
  await settle()
  assert.ok(session.getSnapshot().dialogue)

  engine.emit(TO_SCHOOL)
  await settle()

  assert.equal(session.getSnapshot().dialogue, undefined)
})
