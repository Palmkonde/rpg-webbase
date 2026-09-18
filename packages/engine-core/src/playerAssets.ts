import type { CharacterDefinition } from './types.ts'

export const PLACEHOLDER_TEXTURE_KEY = 'player-placeholder'
const PLACEHOLDER_HEIGHT_SCALE = 2

export interface PlayerTexture {
  key: string
  walkingAnimationMapping?: number
}

interface PickedPlayerTexture {
  texture: PlayerTexture
  warning?: string
}

// character so a previously-loaded character's cached texture can't be mistaken for this one.
export function pickPlayerTexture(character: CharacterDefinition, spriteLoaded: boolean): PickedPlayerTexture {
  const key = `player-${character.id}`
  if (spriteLoaded) {
    return { texture: { key, walkingAnimationMapping: 0 } }
  }
  return {
    texture: { key: PLACEHOLDER_TEXTURE_KEY },
    warning: `[playerAssets] texture "${key}" failed to load; falling back to placeholder`,
  }
}

export function preloadPlayerSprite(scene: Phaser.Scene, character: CharacterDefinition): void {
  scene.load.spritesheet(`player-${character.id}`, character.spriteUrl, {
    frameWidth: character.frameWidth,
    frameHeight: character.frameHeight,
  })
}

function createPlaceholderTexture(scene: Phaser.Scene, tileWidth: number, tileHeight: number): void {
  const height = tileHeight * PLACEHOLDER_HEIGHT_SCALE

  const graphics = scene.add.graphics()
  graphics.fillStyle(0xff5252, 1)
  graphics.fillRect(0, 0, tileWidth, height)
  graphics.generateTexture(PLACEHOLDER_TEXTURE_KEY, tileWidth, height)
  graphics.destroy()
}

export function resolvePlayerTexture(
  scene: Phaser.Scene,
  character: CharacterDefinition,
  tileWidth: number,
  tileHeight: number,
): PlayerTexture {
  const { texture, warning } = pickPlayerTexture(character, scene.textures.exists(`player-${character.id}`))
  if (warning !== undefined) {
    createPlaceholderTexture(scene, tileWidth, tileHeight)
    console.warn(warning)
  }
  return texture
}
