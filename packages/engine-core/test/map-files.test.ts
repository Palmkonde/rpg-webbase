import { collectImages, collectTiledMapAssets } from '../src/tiled-assets.ts'
import { MapFileError } from '../src/map-file-error.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const ASSET_BASE_URL = 'https://files.example/blobs/'

test('collectImages loads a tileset image and a collection tile image from the asset base plus their keys', () => {
  const raw = {
    tilesets: [
      { name: 'ground', firstgid: 1, image: `${'a'.repeat(64)}.png` },
      { name: 'objects', firstgid: 65, tiles: [{ id: 0, image: `${'b'.repeat(64)}.png` }] },
    ],
  }
  assert.deepEqual(collectImages(raw, ASSET_BASE_URL), [
    { key: 'ground', url: `${ASSET_BASE_URL}${'a'.repeat(64)}.png` },
    { key: `${'b'.repeat(64)}.png`, url: `${ASSET_BASE_URL}${'b'.repeat(64)}.png` },
  ])
})

test('collectTiledMapAssets throws a MapFileError carrying the status of a Map the server no longer holds', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = async (): Promise<Response> => new Response('gone', { status: 404 })
  try {
    await assert.rejects(collectTiledMapAssets('https://files.example/blobs/map.tmj', ASSET_BASE_URL), (error: unknown) => error instanceof MapFileError && error.status === 404)
  } finally {
    globalThis.fetch = realFetch
  }
})
