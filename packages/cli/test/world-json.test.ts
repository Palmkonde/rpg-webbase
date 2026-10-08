import { check, expectError, worldJson } from './helpers.ts'
import { test } from 'node:test'

const FILE = 'worlds/demo/world.json'

test('a missing world.json is refused', async () => {
  expectError(await check({ [FILE]: undefined }), FILE, 'does not exist')
})

test('a start Map that does not exist is refused', async () => {
  expectError(await check({ [FILE]: worldJson({ startMap: 'nowhere' }) }), FILE, 'nowhere')
})

test('a spawn tile outside the start Map is refused', async () => {
  expectError(await check({ [FILE]: worldJson({ spawn: { x: 4, y: 0 } }) }), FILE, 'spawn tile (4, 0)')
})

test('a player Character that is not in the Library is refused', async () => {
  expectError(await check({ [FILE]: worldJson({ player: 'ghost' }) }), FILE, 'ghost')
})

test('a world.json that is not an object is refused', async () => {
  expectError(await check({ [FILE]: 'null' }), FILE, 'not a JSON object')
})

test('a world.json missing its startMap, spawn and player is refused', async () => {
  expectError(await check({ [FILE]: '{}' }), FILE, '"startMap"', '"spawn"', '"player"')
})
