import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTilesetAssetUrl, collectTileProperties } from '../src/tiledAssets.ts'

const tiledMapUrl = '/assets/maps/main_test.tmj'
const origin = 'http://localhost'
const expected = 'http://localhost/assets/tilesets/pack/1%20Tiles/image.png'

test('resolveTilesetAssetUrl resolves a well-formed relative path', () => {
  const result = resolveTilesetAssetUrl('../tilesets/pack/1 Tiles/image.png', tiledMapUrl, origin)
  assert.equal(result, expected)
})

test('resolveTilesetAssetUrl ignores authoring-machine-specific prefixes before tilesets/', () => {
  const result = resolveTilesetAssetUrl(
    '../../../test_map/tilesets/pack/1 Tiles/image.png',
    tiledMapUrl,
    origin,
  )
  assert.equal(result, expected)
})

test('resolveTilesetAssetUrl handles a path with no leading .. at all', () => {
  const result = resolveTilesetAssetUrl('tilesets/pack/1 Tiles/image.png', tiledMapUrl, origin)
  assert.equal(result, expected)
})

test('collectTileProperties reads a tile marked collidable on a single-image tileset', () => {
  const raw = {
    tilesets: [
      {
        name: 'ground',
        firstgid: 1,
        image: 'ground.png',
        tiles: [{ id: 3, properties: [{ name: 'ge_collide', value: true }] }],
      },
    ],
  }
  assert.deepEqual(collectTileProperties(raw), new Map([[4, { ge_collide: true }]]))
})

test('collectTileProperties reads a tile marked collidable on an image-collection tileset (no shared image)', () => {
  const raw = {
    tilesets: [
      {
        name: 'objects',
        firstgid: 65,
        tiles: [{ id: 0, image: 'fence.png', properties: [{ name: 'ge_collide', value: true }] }],
      },
    ],
  }
  assert.deepEqual(collectTileProperties(raw), new Map([[65, { ge_collide: true }]]))
})

test('collectTileProperties carries over non-collision and one-way-direction properties too', () => {
  const raw = {
    tilesets: [
      {
        name: 'objects',
        firstgid: 65,
        tiles: [
          { id: 0, properties: [{ name: 'ge_collide_up', value: true }, { name: 'decor_key', value: 'ledge' }] },
        ],
      },
    ],
  }
  assert.deepEqual(collectTileProperties(raw), new Map([[65, { ge_collide_up: true, decor_key: 'ledge' }]]))
})

test('collectTileProperties skips tiles with no properties', () => {
  const raw = {
    tilesets: [
      {
        name: 'objects',
        firstgid: 65,
        tiles: [{ id: 0, properties: [{ name: 'ge_collide', value: false }] }, { id: 1 }],
      },
    ],
  }
  assert.deepEqual(collectTileProperties(raw), new Map([[65, { ge_collide: false }]]))
})
