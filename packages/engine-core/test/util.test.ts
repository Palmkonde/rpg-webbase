import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTilesetAssetUrl } from '../src/util.ts'

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
