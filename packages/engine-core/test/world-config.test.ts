import type { CharacterDefinition, MapDefinition, WorldConfig } from '../src/types.ts'
import { resolveCharacter, resolveCompanions, resolveMap } from '../src/world-config.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const maps: MapDefinition[] = [
  {
    id: 'map-1',
    tiledMapUrl: '/assets/maps/map-1.json',
    spawnPoints: {},
  },
]

const characters: CharacterDefinition[] = [
  {
    id: 'fluffy',
    spriteUrl: '/assets/sprites/characters/fluffy/fluffy.png',
    frameWidth: 16,
    frameHeight: 20,
  },
]

test('resolveMap returns the matching map definition', () => {
  const config: WorldConfig = { mapId: 'map-1', player: { spawn: { x: 0, y: 0 }, characterId: 'fluffy' }, companions: [] }
  const result = resolveMap(config, maps)
  assert.equal(result.id, 'map-1')
})

test('resolveMap throws for an unknown mapId', () => {
  const config: WorldConfig = { mapId: 'does-not-exist', player: { spawn: { x: 0, y: 0 }, characterId: 'fluffy' }, companions: [] }
  assert.throws(() => resolveMap(config, maps), /Unknown mapId/u)
})

test('resolveCharacter returns the matching character definition', () => {
  const config: WorldConfig = { mapId: 'map-1', player: { spawn: { x: 0, y: 0 }, characterId: 'fluffy' }, companions: [] }
  const result = resolveCharacter(config, characters)
  assert.equal(result.id, 'fluffy')
})

test('resolveCharacter throws for an unknown characterId', () => {
  const config: WorldConfig = { mapId: 'map-1', player: { spawn: { x: 0, y: 0 }, characterId: 'does-not-exist' }, companions: [] }
  assert.throws(() => resolveCharacter(config, characters), /Unknown characterId/u)
})

test('resolveCompanions pairs each World Config Companion with its Character', () => {
  const config: WorldConfig = { mapId: 'map-1', player: { spawn: { x: 0, y: 0 }, characterId: 'fluffy' }, companions: [{ entityId: 'Guard', characterId: 'fluffy' }] }

  const result = resolveCompanions(config, characters)

  assert.deepEqual(result, [{ entityId: 'Guard', character: characters[0] }])
})

test('resolveCompanions skips a Companion with an unknown characterId', () => {
  const config: WorldConfig = { mapId: 'map-1', player: { spawn: { x: 0, y: 0 }, characterId: 'fluffy' }, companions: [{ entityId: 'Guard', characterId: 'does-not-exist' }] }

  const result = resolveCompanions(config, characters)

  assert.deepEqual(result, [])
})
