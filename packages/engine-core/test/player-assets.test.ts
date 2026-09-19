import { PLACEHOLDER_TEXTURE_KEY, pickPlayerTexture } from '../src/player-assets.ts'
import type { CharacterDefinition } from '../src/types.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const fluffy: CharacterDefinition = {
  id: 'fluffy',
  spriteUrl: '/assets/sprites/characters/fluffy/fluffy.png',
  frameWidth: 16,
  frameHeight: 20,
}

const temmie: CharacterDefinition = {
  id: 'temmie',
  spriteUrl: '/assets/sprites/characters/temmie/temmie.png',
  frameWidth: 16,
  frameHeight: 20,
}

test('pickPlayerTexture keys the texture per character', () => {
  const result = pickPlayerTexture(fluffy, true)
  assert.notEqual(result.texture.key, pickPlayerTexture(temmie, true).texture.key)
})

test('pickPlayerTexture uses the real spritesheet with characterIndex 0 when it loaded', () => {
  const result = pickPlayerTexture(fluffy, true)
  assert.equal(result.warning, undefined)
  assert.deepEqual(result.texture, { key: 'player-fluffy', walkingAnimationMapping: 0 })
})

test('pickPlayerTexture falls back to the placeholder and names the missing key when the load failed', () => {
  const result = pickPlayerTexture(fluffy, false)
  assert.deepEqual(result.texture, { key: PLACEHOLDER_TEXTURE_KEY })
  assert.ok(result.warning?.includes('player-fluffy'), 'warning must name the missing texture key')
})
