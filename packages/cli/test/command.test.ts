import { check, content, crpg, expectError, expectPass, world } from './helpers.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('a valid World passes and says nothing was uploaded', async () => {
  const run = await check()
  expectPass(run)
  assert.match(run.output, /0 errors/u)
  assert.match(run.output, /nothing was uploaded/u)
})

test('the command runs on Bun as well as Node', async () => {
  const root = await content(world())
  expectPass(await crpg(root, ['publish', 'demo', '--dry-run'], { runtime: 'bun' }))
})

test('running outside a content root is refused', async () => {
  const root = await content({ 'notes.txt': 'hi' })
  const run = await crpg(root, ['publish', 'demo', '--dry-run'])
  assert.notEqual(run.code, 0)
  assert.match(run.output, /not a content root/u)
})

test('a World with no folder is refused', async () => {
  const root = await content(world())
  expectError(await crpg(root, ['publish', 'missing', '--dry-run']), 'worlds/missing')
})

test('files the layout does not recognise are ignored', async () => {
  const ignored = { 'worlds/demo/notes.txt': 'x', 'worlds/demo/maps/readme.md': 'x', 'worlds/demo/scripts/raw.txt': 'x', 'library/characters/hero/raw.png': 'x' }
  expectPass(await check(ignored))
})

test('a World id outside a-z, 0-9, - and _ is refused', async () => {
  const root = await content(world())
  expectError(await crpg(root, ['publish', '../demo', '--dry-run']), 'is not a World folder')
})

test('unexpected arguments print the usage', async () => {
  const root = await content(world())
  const run = await crpg(root, ['frobnicate'])
  assert.notEqual(run.code, 0)
  assert.match(run.output, /Usage: crpg publish/u)
})
