import type { CharacterDefinition } from './types.ts'

export const PLACEHOLDER_TEXTURE_KEY = 'character-placeholder'
const PLACEHOLDER_HEIGHT_SCALE = 2
const PLACEHOLDER_COLOR = 0xFF5252

export interface CharacterTexture {
  key: string
  walkingAnimationMapping?: number
}

interface PickedCharacterTexture {
  texture: CharacterTexture
  warning?: string
}

export interface TileSize {
  width: number
  height: number
}

// Character so a previously-loaded character's cached texture can't be mistaken for this one.
export function pickCharacterTexture(character: CharacterDefinition, spriteLoaded: boolean): PickedCharacterTexture {
  const key = `character-${character.id}`
  if (spriteLoaded) {
    return { texture: { key, walkingAnimationMapping: 0 } }
  }
  return {
    texture: { key: PLACEHOLDER_TEXTURE_KEY },
    warning: `[characterAssets] texture "${key}" failed to load; falling back to placeholder`,
  }
}

export function preloadCharacterSprite(scene: Phaser.Scene, character: CharacterDefinition): void {
  scene.load.spritesheet(`character-${character.id}`, character.spriteUrl, {
    frameWidth: character.frameWidth,
    frameHeight: character.frameHeight,
  })
}

function createPlaceholderTexture(scene: Phaser.Scene, tileSize: TileSize): void {
  const height = tileSize.height * PLACEHOLDER_HEIGHT_SCALE

  const graphics = scene.add.graphics()
  graphics.fillStyle(PLACEHOLDER_COLOR, 1)
  graphics.fillRect(0, 0, tileSize.width, height)
  graphics.generateTexture(PLACEHOLDER_TEXTURE_KEY, tileSize.width, height)
  graphics.destroy()
}

export function resolveCharacterTexture(scene: Phaser.Scene, character: CharacterDefinition, tileSize: TileSize): CharacterTexture {
  const { texture, warning } = pickCharacterTexture(character, scene.textures.exists(`character-${character.id}`))
  if (warning !== undefined) {
    createPlaceholderTexture(scene, tileSize)
    console.warn(warning)
  }
  return texture
}
