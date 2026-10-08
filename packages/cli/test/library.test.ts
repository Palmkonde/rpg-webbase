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
