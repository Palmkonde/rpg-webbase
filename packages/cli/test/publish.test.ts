import type { Files, Run } from './helpers.ts'
import type { Meddling, Service } from './service.ts'
import { PNG, content, crpg, mapWith, world } from './helpers.ts'
import { skipWithoutServices, startService } from './service.ts'
import type { Manifest } from '../src/bundle.ts'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { writeFile } from 'node:fs/promises'

interface Author {
  id: string
  root: string
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

// A baseline World under an id no other run has used, since World ids are permanent on a shared service.
async function author(changes: Files = {}): Promise<Author> {
  const id = `demo-${crypto.randomUUID()}`
  const renamed = Object.entries(world(changes)).map(([file, body]) => [file.replace('worlds/demo/', `worlds/${id}/`), body])
  return { id, root: await content(Object.fromEntries(renamed)) }
}

async function withService(meddling: Meddling, run: (service: Service) => Promise<void>): Promise<void> {
  const service = await startService(meddling)
  try {
    await run(service)
  } finally {
    await service.close()
  }
}

function publish(service: Service, { id, root }: Author, ...args: string[]): Promise<Run> {
  return crpg(root, ['publish', id, ...args], { env: { GAME_SERVICE_URL: service.url, PUBLISH_KEY: service.publishKey } })
}

function uploadCount(run: Run): { uploaded: number; total: number } {
  const counts = /Uploaded (?<uploaded>\d+) of (?<total>\d+) files/u.exec(run.output)?.groups
  return { uploaded: Number(counts?.uploaded), total: Number(counts?.total) }
}

function versionOf(run: Run): string {
  return /version (?<id>[0-9a-f-]{36})/u.exec(run.output)?.groups?.id ?? ''
}

// Publishes a new World and returns what the service made of it.
async function publishNew(service: Service, changes: Files = {}): Promise<{ author: Author; run: Run; manifest: Manifest }> {
  const who = await author(changes)
  const run = await publish(service, who, '--new')
  assert.equal(run.code, 0, run.output)
  return { author: who, run, manifest: await service.manifestOf(versionOf(run)) }
}

test('a first Publish with --new puts the World Version live', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who, run } = await publishNew(service)

    assert.equal(await service.liveId(who.id), versionOf(run))
  })
})

test('the Map is hashed after its tileset paths became keys', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const own = Buffer.from('a tileset of the World')
    const tilesets = [
      { firstgid: 1, name: 'grass', image: '../../../library/tilesets/grass.png', tilewidth: 32, tileheight: 32 },
      { firstgid: 2, name: 'own', image: '../tilesets/own.png', tilewidth: 32, tileheight: 32 },
    ]

    const { manifest } = await publishNew(service, { 'worlds/demo/maps/start.tmj': mapWith({ tilesets }), 'worlds/demo/tilesets/own.png': own })

    const map = await service.blob(manifest.maps.start)
    const rewritten = JSON.parse(map.toString('utf8')) as { tilesets: { image: string }[] }
    assert.equal(manifest.maps.start, `${sha256(map)}.tmj`)
    assert.deepEqual(rewritten.tilesets.map((tileset) => tileset.image), [`${sha256(PNG)}.png`, `${sha256(own)}.png`])
    assert.ok(manifest.files.includes(`${sha256(own)}.png`))
  })
})

const PNG_KEY = `${sha256(PNG)}.png`

for (const [name, field, expected] of [
  ['start', 'start', { map: 'start', spawn: { x: 1, y: 1 }, player: 'hero' }],
  ['Characters', 'characters', { hero: { key: PNG_KEY, frameWidth: 16, frameHeight: 20, offsetY: -8 } }],
  ['Portraits', 'portraits', { Sign: { Happy: PNG_KEY } }],
  ['CGs', 'cgs', { intro: [PNG_KEY] }],
  ['Entities', 'entities', ['Sign']],
] as const) {
  test(`the manifest names the World's ${name}`, { skip: skipWithoutServices }, async () => {
    await withService({}, async (service) => {
      const { manifest } = await publishNew(service)

      assert.deepEqual(manifest[field], expected)
    })
  })
}

test('the manifest names the compiled Scripts, and the file holds bytecode', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { manifest } = await publishNew(service)

    const bytecode = await service.blob(manifest.scripts)
    assert.ok(manifest.scripts.endsWith('.clscb') && bytecode.length > 0)
  })
})

test('a World without a strings.json publishes an empty String Table', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { manifest } = await publishNew(service)

    const strings = await service.blob(manifest.strings)
    assert.deepEqual(JSON.parse(strings.toString('utf8')), { locale: 'en', table: { en: {} } })
  })
})

test('every file of the World is listed in files, once', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { manifest } = await publishNew(service)

    const png = `${sha256(PNG)}.png`
    assert.deepEqual(manifest.files, [png, manifest.maps.start, manifest.scripts, manifest.strings].toSorted())
  })
})

test('CG frames are published in numeric order', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const frames = [1, 2, 10]
    const art = Object.fromEntries(frames.map((frame) => [`worlds/demo/cg/intro/${frame}.png`, Buffer.from(`frame ${frame}`)]))

    const { manifest } = await publishNew(service, art)

    assert.deepEqual(manifest.cgs.intro, frames.map((frame) => `${sha256(Buffer.from(`frame ${frame}`))}.png`))
  })
})

test('a first Publish uploads every file', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { run } = await publishNew(service)

    assert.deepEqual(uploadCount(run), { uploaded: 4, total: 4 })
  })
})

test('a re-Publish of a World that did not change uploads nothing', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who } = await publishNew(service)

    const again = await publish(service, who)

    assert.equal(again.code, 0, again.output)
    assert.deepEqual(uploadCount(again), { uploaded: 0, total: 4 })
  })
})

test('a re-Publish uploads only the file that changed, and goes live', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who } = await publishNew(service)
    await writeFile(`${who.root}/worlds/${who.id}/portraits/Sign/happy.png`, 'new art')

    const changed = await publish(service, who)

    assert.deepEqual(uploadCount(changed), { uploaded: 1, total: 5 })
    assert.equal(await service.liveId(who.id), versionOf(changed))
  })
})

test('a first Publish without --new is refused and nothing goes live', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const who = await author()

    const run = await publish(service, who)

    assert.equal(run.code, 1, run.output)
    assert.match(run.output, /--new/u)
    assert.equal(await service.liveId(who.id), undefined)
  })
})

test('--new for a World that already exists is refused', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who, run: first } = await publishNew(service)

    const run = await publish(service, who, '--new')

    assert.equal(run.code, 1, run.output)
    assert.match(run.output, /already exists/u)
    assert.equal(await service.liveId(who.id), versionOf(first))
  })
})

test('a Publish that lost the race to another is refused and leaves the other live', { skip: skipWithoutServices }, async () => {
  const who = await author()
  let interloper = ''
  const meddling: Meddling = {
    async beforeCommit(tools) {
      const live = await tools.liveId(who.id)
      if (live === undefined || interloper !== '') {return}
      const response = await tools.commit(who.id, { manifest: await tools.manifestOf(live), summary: {}, expectedLive: live })
      interloper = ((await response.json()) as { id: string }).id
    },
  }
  await withService(meddling, async (service) => {
    await publish(service, who, '--new')

    const run = await publish(service, who)

    assert.equal(run.code, 1, run.output)
    assert.match(run.output, /another Publish/iu)
    assert.notEqual(interloper, '')
    assert.equal(await service.liveId(who.id), interloper)
  })
})

test('a file whose bytes change on the way is refused by the service and nothing goes live', { skip: skipWithoutServices }, async () => {
  await withService({ corruptUploads: true }, async (service) => {
    const who = await author()

    const run = await publish(service, who, '--new')

    assert.equal(run.code, 1, run.output)
    assert.match(run.output, /do not hash to the key/u)
    assert.equal(await service.liveId(who.id), undefined)
  })
})

test('a wrong Publish key is refused', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { id, root } = await author()

    const run = await crpg(root, ['publish', id, '--new'], { env: { GAME_SERVICE_URL: service.url, PUBLISH_KEY: 'not-the-key' } })

    assert.equal(run.code, 1, run.output)
    assert.match(run.output, /Publish key/u)
    assert.equal(await service.liveId(id), undefined)
  })
})

test('a Publish without the service settings names them', async () => {
  const { id, root } = await author()

  const run = await crpg(root, ['publish', id, '--new'], { env: { GAME_SERVICE_URL: '', PUBLISH_KEY: '' } })

  assert.equal(run.code, 2, run.output)
  assert.match(run.output, /GAME_SERVICE_URL/u)
  assert.match(run.output, /PUBLISH_KEY/u)
})

test('a World with errors is refused before anything is sent', async () => {
  const { id, root } = await author({ 'worlds/demo/world.json': '{}' })

  const run = await crpg(root, ['publish', id, '--new'], { env: { GAME_SERVICE_URL: 'http://127.0.0.1:1', PUBLISH_KEY: 'x' } })

  assert.equal(run.code, 1, run.output)
  assert.match(run.output, /error: worlds\/.*\/world\.json/u)
})

test('a World with no Scripts still publishes', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const noScripts = { 'worlds/demo/scripts/story.clsc': undefined, 'worlds/demo/portraits/Sign/happy.png': undefined, 'worlds/demo/cg/intro/1.png': undefined }

    const { manifest } = await publishNew(service, noScripts)

    assert.ok(manifest.scripts.endsWith('.clscb'))
  })
})

test('a Game Service that cannot be reached is reported with its address', async () => {
  const { id, root } = await author()

  const run = await crpg(root, ['publish', id, '--new'], { env: { GAME_SERVICE_URL: 'http://127.0.0.1:1', PUBLISH_KEY: 'x' } })

  assert.equal(run.code, 1, run.output)
  assert.match(run.output, /could not reach the Game Service at http:\/\/127\.0\.0\.1:1/u)
})
