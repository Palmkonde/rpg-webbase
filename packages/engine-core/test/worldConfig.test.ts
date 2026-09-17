import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveMap } from '../src/worldConfig.ts'
import type { MapDefinition, WorldConfig } from '../src/types.ts'

const maps: MapDefinition[] = [
  {
    id: 'map-1',
    tiledMapUrl: '/assets/maps/map-1.json',
  },
]

test('resolveMap returns the matching map definition', () => {
  const config: WorldConfig = { mapId: 'map-1', player: { spawn: { x: 0, y: 0 } } }
  const result = resolveMap(config, maps)
  assert.equal(result.id, 'map-1')
})

test('resolveMap throws for an unknown mapId', () => {
  const config: WorldConfig = { mapId: 'does-not-exist', player: { spawn: { x: 0, y: 0 } } }
  assert.throws(() => resolveMap(config, maps), /Unknown mapId/)
})
