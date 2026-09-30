import { PLACEHOLDER_TEXTURE_KEY, pickCharacterTexture } from '../src/character-assets.ts'
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

test('pickCharacterTexture keys the texture per character', () => {
  const result = pickCharacterTexture(fluffy, true)
  assert.notEqual(result.texture.key, pickCharacterTexture(temmie, true).texture.key)
})

test('pickCharacterTexture uses the real spritesheet with characterIndex 0 when it loaded', () => {
  const result = pickCharacterTexture(fluffy, true)
  assert.equal(result.warning, undefined)
  assert.deepEqual(result.texture, { key: 'character-fluffy', walkingAnimationMapping: 0 })
})

test('pickCharacterTexture falls back to the placeholder and names the missing key when the load failed', () => {
  const result = pickCharacterTexture(fluffy, false)
  assert.deepEqual(result.texture, { key: PLACEHOLDER_TEXTURE_KEY })
  assert.ok(result.warning?.includes('character-fluffy'), 'warning must name the missing texture key')
})
