import type { PlayerCharId } from '@codeleagues-rpg-engine/engine-core'

// Pinned to engine-core's own Player charId via its type only — importing the value would pull Phaser into pure-state tests.
export const PLAYER_CHAR_ID: PlayerCharId = 'player'
