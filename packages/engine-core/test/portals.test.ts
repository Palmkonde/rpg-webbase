import { collectPortals, findOverlappingPortals } from '../src/map-objects.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

interface Property { name: string; value: string }

interface Rect { x: number; y: number; width: number; height: number }

function portal(rect: Rect, properties: Property[]): Rect & { name: string; type: string; properties: Property[] } {
  return { name: 'door', type: 'Portal', ...rect, properties }
}

const TILE = { x: 0, y: 0, width: 32, height: 32 }

const TARGET = [{ name: 'targetMap', value: 'school' }, { name: 'targetSpawn', value: 'gate' }]

test('collectPortals reads a Portal-classed rectangle as its covered tiles and its target', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [{ type: 'objectgroup', objects: [portal({ x: 64, y: 0, width: 64, height: 32 }, TARGET)] }],
  }
  assert.deepEqual(collectPortals(raw), [{ tiles: [{ x: 2, y: 0 }, { x: 3, y: 0 }], targetMap: 'school', targetSpawn: 'gate' }])
})

test('collectPortals keeps a Portal missing or blank in a target as blank, so the Engine warns about it, and skips objects of another Class', () => {
  const raw = {
    tilewidth: 32,
    tileheight: 32,
    layers: [
      {
        type: 'objectgroup',
        objects: [
          portal(TILE, [{ name: 'targetMap', value: 'school' }]),
          portal(TILE, [{ name: 'targetMap', value: '' }, { name: 'targetSpawn', value: 'gate' }]),
          { name: 'gate', type: 'Zone', ...TILE, properties: [{ name: 'zoneId', value: 'gate' }, ...TARGET] },
        ],
      },
    ],
  }
  assert.deepEqual(collectPortals(raw), [
    { tiles: [{ x: 0, y: 0 }], targetMap: 'school', targetSpawn: '' },
    { tiles: [{ x: 0, y: 0 }], targetMap: '', targetSpawn: 'gate' },
  ])
})

test('findOverlappingPortals reports each Portal that shares a tile with another, by its target', () => {
  const portals = [
    { tiles: [{ x: 0, y: 0 }, { x: 1, y: 0 }], targetMap: 'school', targetSpawn: 'gate' },
    { tiles: [{ x: 1, y: 0 }], targetMap: 'garden', targetSpawn: 'east' },
    { tiles: [{ x: 9, y: 9 }], targetMap: 'cave', targetSpawn: 'mouth' },
  ]
  assert.deepEqual(findOverlappingPortals(portals), ['school/gate', 'garden/east'])
})
