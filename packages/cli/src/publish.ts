import type { Checked } from './world.ts'
import type { Context } from './problem.ts'
import { PublishError } from './service.ts'
import type { PublishService } from './service.ts'
import { bundleWorld } from './bundle.ts'

// How many files go up at once: enough to hide the round trips, few enough not to flood the service.
const UPLOADS_AT_ONCE = 4

async function inParallel<Item>(items: Item[], limit: number, run: (item: Item) => Promise<void>): Promise<void> {
  const queue = [...items]
  async function worker(): Promise<void> {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      // oxlint-disable-next-line no-await-in-loop -- each worker takes the next file only when its last one is up.
      await run(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

function requireFile(files: Map<string, Buffer>, key: string): Buffer {
  const bytes = files.get(key)
  if (bytes === undefined) {
    throw new Error(`the service asked for ${key}, which is not in the World`)
  }
  return bytes
}

export interface Published {
  version: string
  uploaded: number
  total: number
}

// A World's first Publish needs `--new`, because a World id is permanent once Flags are stored under it (adr/0040).
function checkIntent(worldId: string, live: string | undefined, isNew: boolean): void {
  if (live === undefined && !isNew) {
    throw new PublishError(`World "${worldId}" has never been Published: add --new to create it`)
  }
  if (live !== undefined && isNew) {
    throw new PublishError(`World "${worldId}" already exists: leave out --new to Publish a new version of it`)
  }
}

/**
 * Uploads the files of a checked World that the service lacks, then makes it live if the service's live World Version is still the one seen
 * here (adr/0040). A World's first Publish needs `isNew`, and `isNew` is refused for a World that exists.
 */
export async function publishWorld(context: Context, checked: Checked, options: { isNew: boolean; service: PublishService }): Promise<Published> {
  const { isNew, service } = options
  const live = await service.liveVersion(context.worldId)
  checkIntent(context.worldId, live, isNew)

  const { manifest, files } = await bundleWorld(context, checked)
  const missing = await service.missing(manifest.files)
  await inParallel(missing, UPLOADS_AT_ONCE, async (key) => {
    await service.upload(key, requireFile(files, key))
  })
  const version = await service.commit(context.worldId, manifest, live)
  return { version, uploaded: missing.length, total: manifest.files.length }
}
