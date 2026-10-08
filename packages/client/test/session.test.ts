import { ASSET_BASE_URL, consoleCalls, createFakeEngine, createFakeService, createTestSession, holdEngineCreation, liveVersion, settle, startSession } from './helpers.ts'
import type { CreateEngineOptions, EngineHandle } from '@codeleagues-rpg-engine/engine-core'
import type { HostSession } from '../src/session.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

function shownLine(session: HostSession): string | undefined {
  const { dialogue } = session.getSnapshot()
  return dialogue?.type === 'line' ? dialogue.text : undefined
}

async function talkToSage(): Promise<HostSession> {
  const { session, engine } = await startSession()
  engine.emit({ type: 'interacted', entityId: 'Sage' })
  await settle()
  return session
}

// Up to the Sage's choices, then picks the vision, which waits on the CG until it ends.
async function watchSagesVision(): Promise<{ session: HostSession; choosing: Promise<void> }> {
  const session = await talkToSage()
  await session.advance()
  const choosing = session.choose(0)
  await settle()
  return { session, choosing }
}

test('a session is loading until it starts', () => {
  const session = createTestSession()

  assert.equal(session.getSnapshot().status, 'loading')
})

test('a started session is playing, with nothing on screen', async () => {
  const { session } = await startSession()

  assert.deepEqual(session.getSnapshot(), { status: 'playing', dialogue: undefined, cg: undefined, companions: [], error: undefined })
})

test('an Interaction shows its first line, with its Speaker and Portrait', async () => {
  const session = await talkToSage()

  assert.deepEqual(session.getSnapshot().dialogue, {
    type: 'line',
    speaker: 'Sage',
    text: 'Hello there.',
    portrait: `${ASSET_BASE_URL}sage-happy.png`,
    canDismiss: true,
  })
})

test('advance moves the Dialogue on to its choices, a locked one showing its reason', async () => {
  const session = await talkToSage()

  await session.advance()

  assert.deepEqual(session.getSnapshot().dialogue, {
    type: 'choices',
    choices: [
      { text: 'Show me a vision', locked: undefined },
      { text: 'Open the door', locked: 'You need a key.' },
      { text: 'Bye', locked: undefined },
    ],
    canDismiss: true,
  })
})

test('choose moves the Dialogue on along the picked branch', async () => {
  const session = await talkToSage()
  await session.advance()

  await session.choose(2)

  assert.equal(shownLine(session), 'Farewell.')
})

test('advancing past a run\'s last line clears the Dialogue', async () => {
  const session = await talkToSage()
  await session.advance()
  await session.choose(2)

  await session.advance()

  assert.equal(session.getSnapshot().dialogue, undefined)
})

test('dismissDialogue clears the Dialogue mid-run', async () => {
  const session = await talkToSage()

  await session.dismissDialogue()

  assert.equal(session.getSnapshot().dialogue, undefined)
})

test('a CG a Script plays shows its first frame, with its art, caption and more to come', async () => {
  const { session } = await watchSagesVision()

  assert.deepEqual(session.getSnapshot().cg, { art: `${ASSET_BASE_URL}vision-1.png`, caption: 'A light.', hasMore: true })
})

test('advanceCg steps to the CG\'s next frame', async () => {
  const { session } = await watchSagesVision()

  session.advanceCg()

  assert.deepEqual(session.getSnapshot().cg, { art: `${ASSET_BASE_URL}vision-2.png`, caption: 'A door.', hasMore: false })
})

test('advancing past a CG\'s last frame ends it, and the Dialogue goes on', async () => {
  const { session, choosing } = await watchSagesVision()

  session.advanceCg()
  session.advanceCg()
  await choosing

  assert.equal(session.getSnapshot().cg, undefined)
  assert.equal(shownLine(session), 'Did you see it?')
})

test('skipCg ends a CG from its first frame, and the Dialogue goes on', async () => {
  const { session, choosing } = await watchSagesVision()

  session.skipCg()
  await choosing

  assert.equal(session.getSnapshot().cg, undefined)
  assert.equal(shownLine(session), 'Did you see it?')
})

test('setLocale shows what is on screen in the new Locale', async () => {
  const { session } = await watchSagesVision()

  session.setLocale('th')

  assert.equal(session.getSnapshot().cg?.caption, 'แสงสว่าง')
})

test('a Companion Flag a Script writes shows that Companion, following the Player', async () => {
  const { session, engine } = await startSession()
  engine.emit({ type: 'interacted', entityId: 'Guard' })
  await settle()

  await session.advance()

  assert.deepEqual(session.getSnapshot().companions, ['Guard'])
  assert.ok(engine.calls.includes('follow Guard player 0'))
})

test('a Companion already in the Flags shows once the session starts', async () => {
  const { session } = await startSession({ service: createFakeService({ 'companion:Guard': 'fluffy' }).service })

  assert.deepEqual(session.getSnapshot().companions, ['Guard'])
})

test('dismissCompanion clears the Companion and stops it following', async () => {
  const { session, engine } = await startSession({ service: createFakeService({ 'companion:Guard': 'fluffy' }).service })

  await session.dismissCompanion('Guard')

  assert.deepEqual(session.getSnapshot().companions, [])
  assert.equal(engine.calls.at(-1), 'stop Guard')
})

test('while a Cutscene has control, its Dialogue can\'t be dismissed and Companions are hidden', async () => {
  const { session, engine } = await startSession({ service: createFakeService({ 'companion:Guard': 'fluffy' }).service })

  engine.emit({ type: 'interacted', entityId: 'Statue' })
  await settle()

  const { dialogue, companions } = session.getSnapshot()
  assert.equal(dialogue?.canDismiss, false)
  assert.deepEqual(companions, [])
})

test('a Cutscene ending unpauses the Engine and shows Companions again', async () => {
  const { session, engine } = await startSession({ service: createFakeService({ 'companion:Guard': 'fluffy' }).service })
  engine.emit({ type: 'interacted', entityId: 'Statue' })
  await settle()

  await session.advance()

  assert.deepEqual(session.getSnapshot().companions, ['Guard'])
  assert.deepEqual(engine.calls.filter((call) => call.startsWith('paused')), ['paused true', 'paused false'])
})

test('a Zone\'s Script runs only the first time the Player walks into it', async () => {
  const { session, engine } = await startSession()
  engine.emit({ type: 'zoneEntered', zoneId: 'Gate' })
  await settle()
  await session.advance()

  engine.emit({ type: 'zoneEntered', zoneId: 'Gate' })
  await settle()

  assert.equal(session.getSnapshot().dialogue, undefined)
})

test('destroy mid-Cutscene unpauses the Engine before destroying it', async () => {
  const { session, engine } = await startSession()
  engine.emit({ type: 'interacted', entityId: 'Statue' })
  await settle()

  session.destroy()

  assert.deepEqual(engine.calls.slice(-2), ['paused false', 'destroy'])
})

test('two sessions side by side share no state', async () => {
  const flags = { 'companion:Guard': 'fluffy' }
  const first = await startSession({ service: createFakeService(flags).service })
  const second = await startSession({ service: createFakeService(flags).service })

  first.engine.emit({ type: 'interacted', entityId: 'Statue' })
  await settle()
  await first.session.dismissCompanion('Guard')

  assert.deepEqual(second.session.getSnapshot(), { status: 'playing', dialogue: undefined, cg: undefined, companions: ['Guard'], error: undefined })
})

test('subscribe calls its listener when the snapshot changes, and stops once unsubscribed', async () => {
  const { session, engine } = await startSession()
  let calls = 0
  const unsubscribe = session.subscribe(() => { calls += 1 })

  engine.emit({ type: 'interacted', entityId: 'Sage' })
  await settle()
  const afterLine = calls
  unsubscribe()
  await session.advance()

  assert.ok(afterLine > 0)
  assert.equal(calls, afterLine)
})

test('a CG with no frames is skipped with a warning, and the Dialogue goes on', async () => {
  const { session, engine } = await startSession({ service: createFakeService({}, { ...liveVersion, manifest: { ...liveVersion.manifest, cgs: {} } }).service })
  engine.emit({ type: 'interacted', entityId: 'Sage' })
  await settle()
  await session.advance()

  const warnings = await consoleCalls('warn', () => session.choose(0))

  assert.equal(session.getSnapshot().cg, undefined)
  assert.equal(shownLine(session), 'Did you see it?')
  assert.ok(warnings.some(([message]) => String(message).includes('CG "vision"')))
})

test('a session destroyed while its Scripts load creates no Engine', async () => {
  const engine = createFakeEngine()
  let created = 0
  function createEngine(options: CreateEngineOptions): Promise<EngineHandle> {
    created += 1
    return engine.createEngine(options)
  }
  const session = createTestSession({ createEngine })

  const starting = session.start()
  session.destroy()
  await starting

  assert.equal(created, 0)
  assert.equal(session.getSnapshot().status, 'loading')
})

test('a session destroyed while its Engine is created destroys that Engine once it arrives', async () => {
  const engine = createFakeEngine()
  const held = holdEngineCreation(engine)
  const session = createTestSession({ createEngine: held.createEngine })

  const starting = session.start()
  await held.creating
  session.destroy()
  held.release()
  await starting

  assert.deepEqual(engine.calls, ['destroy'])
  assert.equal(session.getSnapshot().status, 'loading')
})
