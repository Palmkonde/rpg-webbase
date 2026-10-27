import { consoleCalls, settle, startSession } from './helpers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const TO_SCHOOL = { type: 'transitioned', fromMapId: 'town', toMapId: 'school', spawn: { x: 5, y: 1 } } as const
const ARRIVAL_LINE = { type: 'line', speaker: 'Narrator', text: 'You arrive at the school.', portrait: undefined, canDismiss: true }

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

  engine.emit({ ...TO_SCHOOL, toMapId: 'town' })
  await settle()

  assert.equal(session.getSnapshot().dialogue, undefined)
})

test('arriving on a Map with an arrive handler shows its Dialogue', async () => {
  const { session, engine } = await startSession()

  engine.emit(TO_SCHOOL)
  await settle()

  assert.deepEqual(session.getSnapshot().dialogue, ARRIVAL_LINE)
})

test('arriving on a Map with no arrive handler shows nothing', async () => {
  const { session, engine } = await startSession()

  const errors = await consoleCalls('error', async () => {
    engine.emit({ ...TO_SCHOOL, toMapId: 'town' })
    await settle()
  })

  assert.equal(session.getSnapshot().dialogue, undefined)
  assert.deepEqual(errors, [])
})

test('a Zone entered while the arrival Script plays is dropped, so the arrival stays and the Zone stays unseen', async () => {
  const { session, engine } = await startSession()
  engine.emit(TO_SCHOOL)
  await settle()

  engine.emit({ type: 'zoneEntered', zoneId: 'Gate' })
  await settle()

  assert.deepEqual(session.getSnapshot().dialogue, ARRIVAL_LINE)
  await session.dismissDialogue()
  engine.emit({ type: 'zoneEntered', zoneId: 'Gate' })
  await settle()
  assert.deepEqual(session.getSnapshot().dialogue, { ...ARRIVAL_LINE, text: 'You pass the gate.' })
})
