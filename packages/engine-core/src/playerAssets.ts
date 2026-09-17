const PLAYER_TEXTURE_KEY = 'player-placeholder'
const PLACEHOLDER_HEIGHT_SCALE = 2

export function loadPlayerTexture(scene: Phaser.Scene, tileWidth: number, tileHeight: number): string {
  const height = tileHeight * PLACEHOLDER_HEIGHT_SCALE

  // player placeholder in case texture load wrongly
  const graphics = scene.add.graphics()
  graphics.fillStyle(0xff5252, 1)
  graphics.fillRect(0, 0, tileWidth, height)
  graphics.generateTexture(PLAYER_TEXTURE_KEY, tileWidth, height)
  graphics.destroy()

  return PLAYER_TEXTURE_KEY
}
