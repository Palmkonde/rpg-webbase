import type { Files, Run } from './helpers.ts'
import { crpg, world } from './helpers.ts'
import { publish, publishNew, versionOf, withService } from './author.ts'
import { readFile, writeFile } from 'node:fs/promises'
import type { Author } from './author.ts'
import type { Service } from './service.ts'
import assert from 'node:assert/strict'
import { skipWithoutServices } from './service.ts'
import { test } from 'node:test'

function answering(service: Service, { id, root }: Author, input: string): Promise<Run> {
  return crpg(root, ['publish', id], { env: { GAME_SERVICE_URL: service.url, PUBLISH_KEY: service.publishKey }, input })
}

// The baseline Script with one more declared Flag.
function scriptDeclaring(flag: string): Files {
  return { 'worlds/demo/scripts/story.clsc': `${world()['worlds/demo/scripts/story.clsc'] as string}\nflag ${flag}: bool = false;\n` }
}

// Publishes a World declaring `met`, then renames that Flag in the content folder, so the next Publish removes one Flag and adds one.
async function publishedThenRenamed(service: Service): Promise<{ author: Author; first: Run }> {
  const { author: who, run: first } = await publishNew(service, scriptDeclaring('met'))
  const script = `${who.root}/worlds/${who.id}/scripts/story.clsc`
  const text = await readFile(script, 'utf8')
  await writeFile(script, text.replace('flag met:', 'flag met_guard:'))
  return { author: who, first }
}

test('a re-Publish that renames a Flag shows one removal and one addition, and asks first', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who, first } = await publishedThenRenamed(service)

    const run = await answering(service, who, 'n\n')

    assert.equal(run.code, 1, run.output)
    assert.match(run.output, /Flags:\n {2}\+ met_guard\n {2}- met\nPublish anyway\? \[y\/N\]/u)
    assert.equal(await service.liveId(who.id), versionOf(first))
  })
})

test('a Publish answered yes goes live', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who } = await publishedThenRenamed(service)

    const run = await answering(service, who, 'y\n')

    assert.equal(run.code, 0, run.output)
    assert.equal(await service.liveId(who.id), versionOf(run))
  })
})

test('a Publish with a closed stdin is declined', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who, first } = await publishedThenRenamed(service)

    const run = await publish(service, who)

    assert.equal(run.code, 1, run.output)
    assert.equal(await service.liveId(who.id), versionOf(first))
  })
})

test('--yes goes live without asking', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who } = await publishedThenRenamed(service)

    const run = await publish(service, who, '--yes')

    assert.equal(run.code, 0, run.output)
    assert.match(run.output, /\+ met_guard/u)
    assert.doesNotMatch(run.output, /Publish anyway/u)
    assert.equal(await service.liveId(who.id), versionOf(run))
  })
})

test('--dry-run prints the report and uploads nothing', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who, first } = await publishedThenRenamed(service)

    const run = await publish(service, who, '--dry-run')

    assert.equal(run.code, 0, run.output)
    assert.match(run.output, /Flags:\n {2}\+ met_guard\n {2}- met/u)
    assert.equal(await service.liveId(who.id), versionOf(first))
  })
})

test('a re-Publish that changes no Flag, Zone or Companion mover does not ask', { skip: skipWithoutServices }, async () => {
  await withService({}, async (service) => {
    const { author: who } = await publishNew(service, scriptDeclaring('met'))

    const run = await publish(service, who)

    assert.equal(run.code, 0, run.output)
    assert.doesNotMatch(run.output, /Publish anyway/u)
  })
})
