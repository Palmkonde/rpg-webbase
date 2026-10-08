import { ASSET_BASE_URL, createFakeEngine, createFakeService, liveVersion, startSession } from './helpers.ts'
import type { FakeService } from './helpers.ts'
import type { WorldVersion } from '../src/world-version.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

async function startWith(stored: Record<string, boolean | string>, version: WorldVersion = liveVersion): Promise<{ fake: FakeService; session: Awaited<ReturnType<typeof startSession>>['session'] }> {
  const fake = createFakeService(stored, version)
  const { session } = await startSession({ service: fake.service })
  return { fake, session }
}

function withEntities(entities: string[]): WorldVersion {
  return { ...liveVersion, manifest: { ...liveVersion.manifest, entities } }
}

test('the session asks for the live World Version once, then fetches its Scripts and String Table from the asset base plus their keys', async () => {
  const { fake } = await startWith({})

  assert.deepEqual(fake.calls.filter((call) => !call.startsWith('readFlags')), [
    'readLiveVersion student-token',
    'readFile https://files.test/blobs/scripts.clscb',
    'readFile https://files.test/blobs/strings.json',
  ])
})

test('the Engine starts on the manifest\'s Map, spawn and Player Character, every file under the asset base', async () => {
  const engine = createFakeEngine()
  await startSession({ createEngine: engine.createEngine })

  assert.deepEqual(engine.created?.worldConfig, { mapId: 'town', player: { spawn: { x: 2, y: 3 }, characterId: 'fluffy' } })
  assert.deepEqual(engine.created?.catalogs, {
    maps: [{ id: 'town', tiledMapUrl: `${ASSET_BASE_URL}town.tmj` }],
    characters: [{ id: 'fluffy', spriteUrl: `${ASSET_BASE_URL}fluffy.png`, frameWidth: 16, frameHeight: 20, offsetY: -8 }],
  })
  assert.equal(engine.created?.assetBaseUrl, ASSET_BASE_URL)
})

test('a stored Companion whose Entity the World Version no longer has is dismissed, and saved as false', async () => {
  const { fake, session } = await startWith({ 'companion:Guard': 'fluffy' }, withEntities(['Sage']))

  assert.deepEqual(session.getSnapshot().companions, [])
  assert.deepEqual(fake.patches, [{ 'companion:Guard': false }])
})

test('a stored Companion whose mover the Scripts no longer declare is dismissed, and saved as false', async () => {
  const { fake, session } = await startWith({ 'companion:Ghost': 'fluffy' }, withEntities(['Sage', 'Ghost']))

  assert.deepEqual(session.getSnapshot().companions, [])
  assert.deepEqual(fake.patches, [{ 'companion:Ghost': false }])
})

test('a stored Companion the World Version still has stays, with nothing saved', async () => {
  const { fake, session } = await startWith({ 'companion:Guard': 'fluffy' })

  assert.deepEqual(session.getSnapshot().companions, ['Guard'])
  assert.deepEqual(fake.patches, [])
})

test('a Companion already dismissed is not saved as false again', async () => {
  const { fake } = await startWith({ 'companion:Guard': false }, withEntities([]))

  assert.deepEqual(fake.patches, [])
})
