import { X, check, expectError, expectPass } from './helpers.ts'
import { test } from 'node:test'

const STORY = 'worlds/demo/scripts/story.clsc'

test('a Character a Script declares that is not in the Library is refused', async () => {
  expectError(await check({ [STORY]: 'character ghost;\n' }), `${STORY}:1`, 'ghost')
})

test('a Portrait folder for an undeclared Speaker is refused', async () => {
  expectError(await check({ 'worlds/demo/portraits/Ghost/happy.png': X }), 'worlds/demo/portraits/Ghost', 'Ghost')
})

test('a Portrait outside the five Expressions is refused', async () => {
  expectError(await check({ 'worlds/demo/portraits/Sign/furious.png': X }), 'worlds/demo/portraits/Sign/furious.png', 'furious')
})

test('a Portrait a Script uses that has no file is refused', async () => {
  expectError(await check({ 'worlds/demo/portraits/Sign/happy.png': undefined }), `${STORY}:7`, 'Sign(Happy)', 'portraits/Sign/happy.png')
})

test('a raw.* file among the Portraits is ignored', async () => {
  expectPass(await check({ 'worlds/demo/portraits/Sign/raw.png': X }))
})

test('a CG a Script declares that has no frames is refused', async () => {
  expectError(await check({ 'worlds/demo/cg/intro/1.png': undefined }), `${STORY}:4`, 'intro', 'cg/intro')
})

test('a raw.* file is not a CG frame', async () => {
  expectError(await check({ 'worlds/demo/cg/intro/1.png': undefined, 'worlds/demo/cg/intro/raw.png': X }), 'cg/intro')
})

const HERO_JSON = 'library/characters/hero/character.json'

test('a Character with no character.json is refused', async () => {
  expectError(await check({ [HERO_JSON]: undefined }), HERO_JSON, 'does not exist')
})

test('a character.json without a frame height is refused', async () => {
  expectError(await check({ [HERO_JSON]: JSON.stringify({ frameWidth: 16 }) }), HERO_JSON, 'frameHeight')
})

test('a character.json with a fractional frame width is refused', async () => {
  expectError(await check({ [HERO_JSON]: JSON.stringify({ frameWidth: 1.5, frameHeight: 20 }) }), HERO_JSON, 'frameWidth')
})

test('a character.json with an offsetY that is not a number is refused', async () => {
  expectError(await check({ [HERO_JSON]: JSON.stringify({ frameWidth: 16, frameHeight: 20, offsetY: 'up' }) }), HERO_JSON, 'offsetY')
})

test('a character.json that is not JSON is refused', async () => {
  expectError(await check({ [HERO_JSON]: 'nope' }), HERO_JSON, 'not valid JSON')
})

test('a character.json may leave offsetY out', async () => {
  expectPass(await check({ [HERO_JSON]: JSON.stringify({ frameWidth: 16, frameHeight: 20 }) }))
})
