import { computeCameraBounds, resolveTilesetAssetUrl } from '../src/util.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

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

test('computeCameraBounds returns the map pixel rect starting at the origin', () => {
  const result = computeCameraBounds(480, 480)
  assert.deepEqual(result, { x: 0, y: 0, width: 480, height: 480 })
})

test('computeCameraBounds handles a single-tile map', () => {
  const result = computeCameraBounds(32, 32)
  assert.deepEqual(result, { x: 0, y: 0, width: 32, height: 32 })
})

test('computeCameraBounds handles a very large map', () => {
  const result = computeCameraBounds(102_400, 81_920)
  assert.deepEqual(result, { x: 0, y: 0, width: 102_400, height: 81_920 })
})
