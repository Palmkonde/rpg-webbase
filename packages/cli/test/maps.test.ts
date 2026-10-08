import { X, check, expectError, mapWith, mapWithObjects, tiledObject } from './helpers.ts'
import { test } from 'node:test'

const MAP = 'worlds/demo/maps/start.tmj'

test('an XML Map is refused', async () => {
  expectError(await check({ 'worlds/demo/maps/other.tmx': '<map/>' }), 'worlds/demo/maps/other.tmx', '.tmj')
})

test('a Map that is not JSON is refused', async () => {
  expectError(await check({ [MAP]: '{' }), MAP, 'not valid JSON')
})

test('a Map that is not orthogonal is refused', async () => {
  expectError(await check({ [MAP]: mapWith({ orientation: 'isometric' }) }), MAP, 'isometric')
})

test('an infinite Map is refused', async () => {
  expectError(await check({ [MAP]: mapWith({ infinite: true }) }), MAP, 'infinite')
})

test('compressed layer data is refused', async () => {
  const layers = [{ type: 'tilelayer', name: 'ground', encoding: 'base64', compression: 'zlib', data: 'eJw=' }]
  expectError(await check({ [MAP]: mapWith({ layers }) }), MAP, 'zlib')
})

test('Maps of different tile sizes are refused', async () => {
  expectError(await check({ 'worlds/demo/maps/zeta.tmj': mapWith({ tilewidth: 16, tileheight: 16 }) }), 'worlds/demo/maps/zeta.tmj', '16x16', '32x32')
})

test('a duplicate Entity id on one Map is refused', async () => {
  const objects = mapWithObjects(tiledObject('Entity', 'Sign'), tiledObject('Entity', 'Sign'))
  expectError(await check({ [MAP]: objects }), MAP, 'Entity id "Sign"')
})

test('a Zone id repeated on another Map of the World is refused', async () => {
  const other = mapWithObjects(tiledObject('Zone', 'Gate'))
  expectError(await check({ 'worlds/demo/maps/zeta.tmj': other }), 'worlds/demo/maps/zeta.tmj', 'Zone id "Gate"', 'Map "start"')
})

test('a Character an Entity names that is not in the Library is refused', async () => {
  const guard = tiledObject('Entity', 'Guard', [{ name: 'characterId', type: 'string', value: 'ghost' }])
  expectError(await check({ [MAP]: mapWithObjects(guard) }), MAP, 'ghost', 'library/characters/ghost')
})

test('a raw.* file beside a Character sheet is not read', async () => {
  expectError(await check({ 'library/characters/hero/hero.png': undefined, 'library/characters/hero/raw.png': X }), 'hero')
})

test('a Map holding null is refused, not crashed on', async () => {
  expectError(await check({ [MAP]: 'null' }), MAP, 'not a JSON object')
})

test('objects in a nested layer group are seen', async () => {
  const group = mapWith({ layers: [{ type: 'group', name: 'g', layers: [{ type: 'objectgroup', name: 'o', objects: [tiledObject('Entity', 'Sign'), tiledObject('Entity', 'Sign')] }] }] })
  expectError(await check({ [MAP]: group }), MAP, 'Entity id "Sign"')
})
