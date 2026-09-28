import { collectZones, findOverlappingZoneIds } from '../src/tiled-assets.ts'
import assert from 'node:assert/strict'
import { findDuplicates } from '../src/util.ts'
import { test } from 'node:test'

test('collectZones reads a Zone-classed rectangle, converting its pixel rect to the full covered tile list', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [
          { name: 'Fountain Room', type: 'Zone', x: 64, y: 32, width: 96, height: 64, properties: [{ name: 'zoneId', value: 'fountain_room' }] },
        ],
      },
    ],
  }
  assert.deepEqual(collectZones(raw), [
    {
      zoneId: 'fountain_room',
      tiles: [
        { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
        { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
      ],
    },
  ])
})

test('collectZones reads zoneId from the dedicated property, not the freeform name field', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [
          { name: 'renamed for authoring clarity', type: 'Zone', x: 0, y: 0, width: 32, height: 32, properties: [{ name: 'zoneId', value: 'entrance' }] },
        ],
      },
    ],
  }
  assert.deepEqual(collectZones(raw), [{ zoneId: 'entrance', tiles: [{ x: 0, y: 0 }] }])
})

test('collectZones skips a Zone-classed object with a missing or blank zoneId property', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [
          { name: 'no zoneId property at all', type: 'Zone', x: 0, y: 0, width: 32, height: 32 },
          { name: 'blank zoneId', type: 'Zone', x: 0, y: 0, width: 32, height: 32, properties: [{ name: 'zoneId', value: '' }] },
        ],
      },
    ],
  }
  assert.deepEqual(collectZones(raw), [])
})

test('collectZones skips objects tagged with a different or no Custom Class', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [
          { name: 'shopkeeper', type: 'Entity', x: 0, y: 0, properties: [{ name: 'entityId', value: 'shopkeeper' }] },
          { name: 'untagged', x: 0, y: 0 },
        ],
      },
    ],
  }
  assert.deepEqual(collectZones(raw), [])
})

// This just proves the call site — findDuplicates itself is generic and already fully tested (util.test.ts).
test('two Zones sharing a zoneId are caught by findDuplicates, the same way duplicate entityIds are', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [
          { name: 'a', type: 'Zone', x: 0, y: 0, width: 32, height: 32, properties: [{ name: 'zoneId', value: 'dup' }] },
          { name: 'b', type: 'Zone', x: 64, y: 64, width: 32, height: 32, properties: [{ name: 'zoneId', value: 'dup' }] },
        ],
      },
    ],
  }
  const zoneIds = collectZones(raw).map((zone) => zone.zoneId)
  assert.deepEqual(findDuplicates(zoneIds), ['dup'])
})

test('collectZones ignores non-object (tile) layers', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [{ type: 'tilelayer' }],
  }
  assert.deepEqual(collectZones(raw), [])
})

test('findOverlappingZoneIds reports nothing when two Zones\' tile lists are disjoint', () => {
  const zones = [
    { zoneId: 'a', tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    { zoneId: 'b', tiles: [{ x: 5, y: 5 }] },
  ]
  assert.deepEqual(findOverlappingZoneIds(zones), [])
})

test('findOverlappingZoneIds reports both ids when two Zones share at least one tile', () => {
  const zones = [
    { zoneId: 'a', tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    { zoneId: 'b', tiles: [{ x: 1, y: 0 }, { x: 2, y: 0 }] },
    { zoneId: 'c', tiles: [{ x: 9, y: 9 }] },
  ]
  assert.deepEqual(findOverlappingZoneIds(zones), ['a', 'b'])
})
