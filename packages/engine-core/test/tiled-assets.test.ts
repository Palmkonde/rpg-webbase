import { collectEntities, collectTileAnimations, collectTileProperties } from '../src/tiled-assets.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

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

test('collectEntities reads an Entity-classed object, converting its pixel position to a grid cell', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [
          { name: 'Shopkeeper Sprite', type: 'Entity', x: 96, y: 64, properties: [{ name: 'entityId', value: 'shopkeeper' }] },
        ],
      },
    ],
  }
  assert.deepEqual(collectEntities(raw), [{ entityId: 'shopkeeper', x: 3, y: 2 }])
})

test('collectEntities reads entityId from the dedicated property, not the freeform name field', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [
          { name: 'renamed for authoring clarity', type: 'Entity', x: 0, y: 0, properties: [{ name: 'entityId', value: 'shopkeeper' }] },
        ],
      },
    ],
  }
  assert.deepEqual(collectEntities(raw), [{ entityId: 'shopkeeper', x: 0, y: 0 }])
})

test('collectEntities skips an Entity-classed object with a missing or blank entityId property', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [
          { name: 'no entityId property at all', type: 'Entity', x: 0, y: 0 },
          { name: 'blank entityId', type: 'Entity', x: 0, y: 0, properties: [{ name: 'entityId', value: '' }] },
        ],
      },
    ],
  }
  assert.deepEqual(collectEntities(raw), [])
})

test('collectEntities skips objects tagged with a different or no Custom Class', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [
          { name: 'starting_spawn', type: 'spawn', x: 240, y: 399 },
          { name: 'untagged', x: 0, y: 0 },
        ],
      },
    ],
  }
  assert.deepEqual(collectEntities(raw), [])
})

test('collectEntities ignores non-object (tile) layers', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [{ type: 'tilelayer' }],
  }
  assert.deepEqual(collectEntities(raw), [])
})

test('collectEntities floors a fractional pixel position down to its containing grid cell', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [{ name: 'sign', type: 'Entity', x: 95.9, y: 63.1, properties: [{ name: 'entityId', value: 'sign' }] }],
      },
    ],
  }
  assert.deepEqual(collectEntities(raw), [{ entityId: 'sign', x: 2, y: 1 }])
})

test('collectEntities corrects a tile object (gid set) from its bottom-left anchor to the top-left grid cell', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        // Stamped at grid (3,2): Tiled writes y as the *bottom* of that cell, i.e. (2+1)*32.
        objects: [
          { name: 'campfire', type: 'Entity', x: 96, y: 96, gid: 109, properties: [{ name: 'entityId', value: 'campfire' }] },
        ],
      },
    ],
  }
  assert.deepEqual(collectEntities(raw), [{ entityId: 'campfire', x: 3, y: 2 }])
})
