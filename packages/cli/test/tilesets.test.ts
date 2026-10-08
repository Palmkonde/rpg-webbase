import { X, check, expectError, expectPass, mapWith, tilesetMap } from './helpers.ts'
import { test } from 'node:test'

const MAP = 'worlds/demo/maps/start.tmj'

test('a World tileset resolves from its last tilesets/ segment', async () => {
  expectPass(await check({ [MAP]: tilesetMap(String.raw`C:\Users\a\tilesets\x.png`), 'worlds/demo/tilesets/x.png': X }))
})

test('a tileset path with no anchor names the Map and the path', async () => {
  expectError(await check({ [MAP]: tilesetMap('../art/x.png') }), MAP, '"start"', '../art/x.png')
})

test('a tileset that points at a missing file is reported', async () => {
  expectError(await check({ [MAP]: tilesetMap('../tilesets/gone.png') }), MAP, 'worlds/demo/tilesets/gone.png')
})

test('a Library tileset that is missing is reported', async () => {
  expectError(await check({ [MAP]: tilesetMap('../../../library/tilesets/gone.png') }), 'library/tilesets/gone.png')
})

test('the image of every tile in a collection tileset is checked', async () => {
  const map = mapWith({ tilesets: [{ firstgid: 1, name: 't', tiles: [{ id: 0, image: '../tilesets/gone.png' }] }] })
  expectError(await check({ [MAP]: map }), 'worlds/demo/tilesets/gone.png')
})

test('an external tileset is refused', async () => {
  expectError(await check({ [MAP]: mapWith({ tilesets: [{ firstgid: 1, source: 'grass.tsj' }] }) }), MAP, 'external tileset')
})

test('a tileset path climbing out of the anchor is refused', async () => {
  expectError(await check({ [MAP]: tilesetMap('tilesets/../../secret.png') }), MAP, 'does not exist')
})
