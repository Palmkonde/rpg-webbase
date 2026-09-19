import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectTileAnimations, collectTileProperties } from '../src/tiled-assets.ts'

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

test('collectTileAnimations converts frame tileids to gids using the owning tileset firstgid', () => {
  const raw = {
    tilesets: [
      {
        name: 'animationObject',
        firstgid: 109,
        tiles: [
          {
            id: 1,
            animation: [
              { tileid: 1, duration: 100 },
              { tileid: 2, duration: 100 },
            ],
          },
          { id: 2 },
        ],
      },
    ],
  }
  assert.deepEqual(
    collectTileAnimations(raw),
    new Map([
      [
        110,
        [
          { gid: 110, duration: 100 },
          { gid: 111, duration: 100 },
        ],
      ],
    ]),
  )
})

test('collectTileAnimations skips tiles with no animation', () => {
  const raw = {
    tilesets: [
      {
        name: 'objects',
        firstgid: 65,
        tiles: [{ id: 0, image: 'fence.png' }],
      },
    ],
  }
  assert.deepEqual(collectTileAnimations(raw), new Map())
})

test('collectTileAnimations keys frames per tileset when multiple tilesets are present', () => {
  const raw = {
    tilesets: [
      { name: 'ground', firstgid: 1, image: 'ground.png' },
      {
        name: 'animationObject',
        firstgid: 109,
        tiles: [{ id: 1, animation: [{ tileid: 1, duration: 100 }, { tileid: 2, duration: 150 }] }],
      },
    ],
  }
  assert.deepEqual(
    collectTileAnimations(raw),
    new Map([
      [
        110,
        [
          { gid: 110, duration: 100 },
          { gid: 111, duration: 150 },
        ],
      ],
    ]),
  )
})
