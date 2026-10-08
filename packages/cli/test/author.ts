import type { Files, Run } from './helpers.ts'
import type { Meddling, Service } from './service.ts'
import { content, crpg, world } from './helpers.ts'
import type { Manifest } from '../src/bundle.ts'
import assert from 'node:assert/strict'
import { startService } from './service.ts'

export interface Author {
  id: string
  root: string
}

// A baseline World under an id no other run has used, since World ids are permanent on a shared service.
export async function author(changes: Files = {}): Promise<Author> {
  const id = `demo-${crypto.randomUUID()}`
  const renamed = Object.entries(world(changes)).map(([file, body]) => [file.replace('worlds/demo/', `worlds/${id}/`), body])
  return { id, root: await content(Object.fromEntries(renamed)) }
}

export async function withService(meddling: Meddling, run: (service: Service) => Promise<void>): Promise<void> {
  const service = await startService(meddling)
  try {
    await run(service)
  } finally {
    await service.close()
  }
}

export function publish(service: Service, { id, root }: Author, ...args: string[]): Promise<Run> {
  return crpg(root, ['publish', id, ...args], { env: { GAME_SERVICE_URL: service.url, PUBLISH_KEY: service.publishKey } })
}

export function versionOf(run: Run): string {
  return /version (?<id>[0-9a-f-]{36})/u.exec(run.output)?.groups?.id ?? ''
}

export async function publishNew(service: Service, changes: Files = {}): Promise<{ author: Author; run: Run; manifest: Manifest }> {
  const who = await author(changes)
  const run = await publish(service, who, '--new')
  assert.equal(run.code, 0, run.output)
  return { author: who, run, manifest: await service.manifestOf(versionOf(run)) }
}
