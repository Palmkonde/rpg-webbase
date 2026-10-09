import { author, prune, publish, publishNew, versionOf, versions, withService } from './author.ts'
import type { Author } from './author.ts'
import type { Service } from './service.ts'
import assert from 'node:assert/strict'
import { mapWith } from './helpers.ts'
import { skipWithoutServices } from './service.ts'
import { test } from 'node:test'
import { writeFile } from 'node:fs/promises'

const PAST_GRACE_DAYS = 91

interface Replaced {
  author: Author

  // The first World Version, now retired, and the Map file only it names.
  retired: string
  own: string
  live: string
}

// A Map no other run has published: files are named by their content hash, and the database outlives a run, so a shared Map would count as kept.
function uniqueMap(): string {
  return mapWith({ nextobjectid: Math.floor(Math.random() * 1e9) })
}

// Publishes a World, then a second World Version whose Map differs.
async function replaced(service: Service): Promise<Replaced> {
  const first = await publishNew(service, { 'worlds/demo/maps/start.tmj': uniqueMap() })
  await writeFile(`${first.author.root}/worlds/${first.author.id}/maps/start.tmj`, uniqueMap())
  const second = await publish(service, first.author)
  assert.equal(second.code, 0, second.output)
  return { author: first.author, retired: versionOf(first.run), own: first.manifest.maps.start, live: versionOf(second) }
}

test('prune removes the files of a World Version past the grace period and says which', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who, retired, own } = await replaced(service)
    await service.retireDaysAgo(retired, PAST_GRACE_DAYS)

    const pruned = await prune(service, who)

    assert.equal(pruned.code, 0, pruned.output)
    assert.ok(pruned.output.includes(own), pruned.output)
    await assert.rejects(service.blob(own))
  })
})

test('prune inside the grace period removes nothing', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who, own } = await replaced(service)

    const pruned = await prune(service, who)

    assert.equal(pruned.code, 0, pruned.output)
    assert.match(pruned.output, /Nothing to prune/u)
    const kept = await service.blob(own)
    assert.ok(kept.length > 0)
  })
})

test('prune --version retires an old World Version at once', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who, retired, own } = await replaced(service)

    const pruned = await prune(service, who, '--version', retired)

    assert.equal(pruned.code, 0, pruned.output)
    assert.ok(pruned.output.includes(own), pruned.output)
    await assert.rejects(service.blob(own))
  })
})

test('prune --version with the live World Version is refused and removes nothing', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who, live } = await replaced(service)

    const pruned = await prune(service, who, '--version', live)

    assert.equal(pruned.code, 1, pruned.output)
    assert.match(pruned.output, /live World Version/u)
    assert.equal(await service.liveId(who.id), live)
    const manifest = await service.manifestOf(live)
    assert.ok(manifest.files.length > 0)
  })
})

test('prune --version with an unknown World Version is refused', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const pruned = await prune(service, await author(), '--version', crypto.randomUUID())

    assert.equal(pruned.code, 1, pruned.output)
    assert.match(pruned.output, /No such World Version/u)
  })
})

test('versions lists a World\'s World Versions newest first, marking the live one and when the others retired', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who, retired, live } = await replaced(service)

    const listed = await versions(service, who)

    assert.equal(listed.code, 0, listed.output)
    const lines = listed.output.trim().split('\n')
    assert.equal(lines.length, 2, listed.output)
    assert.ok(lines[0].startsWith(live) && lines[0].endsWith('live'), lines[0])
    assert.ok(lines[1].startsWith(retired) && /retired \d{4}-\d{2}-\d{2}/u.test(lines[1]), lines[1])
  })
})

test('versions for a World never Published says so', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const listed = await versions(service, await author())

    assert.equal(listed.code, 1, listed.output)
    assert.match(listed.output, /never been Published/u)
  })
})
