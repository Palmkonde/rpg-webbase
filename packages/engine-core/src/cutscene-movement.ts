import type { GridEngine } from 'grid-engine'
import type { TileCoord } from './tiled-assets.ts'

// Every character is created in this group, so they all block each other.
export const CHARACTER_COLLISION_GROUP = 'character'

export interface CutsceneMovement {
  moveTo: (charId: string, targetPos: TileCoord) => Promise<void>
  follow: (followerId: string, leaderId: string, gap: number) => void
  stopMovement: (charId: string) => void
  setBlocksCharacters: (charId: string, blocks: boolean) => void
}

// Host-commanded movement for Cutscene Movement/Follow steps and Companions. A trail isn't a grid-engine movement, so a new moveTo or a stop has to cancel it here.
export function createCutsceneMovement(gridEngine: GridEngine, playerId: string): CutsceneMovement {
  const trails = new Map<string, () => void>()

  function cancelTrail(charId: string): void {
    trails.get(charId)?.()
    trails.delete(charId)
  }

  // Replays the leader's exact footsteps, one tile at a time, `gap` footsteps behind; returns a cancel function (adr/0027).
  function startTrail(followerId: string, leaderId: string, gap: number): () => void {
    const vacatedTiles: TileCoord[] = []
    let walking = false
    let cancelled = false

    function stepAlongTrail(): void {
      if (cancelled || walking || vacatedTiles.length <= gap) {return}
      walking = true
      gridEngine.moveTo(followerId, vacatedTiles.shift()!).subscribe(() => {
        walking = false
        stepAlongTrail()
      })
    }

    // PositionChangeFinished, not Started: grid-engine keeps the exit tile blocked until the step finishes.
    const subscription = gridEngine.positionChangeFinished().subscribe(({ charId, exitTile }) => {
      if (charId !== leaderId) {return}
      vacatedTiles.push(exitTile)
      stepAlongTrail()
    })

    return () => {
      cancelled = true
      vacatedTiles.length = 0
      subscription.unsubscribe()
    }
  }

  return {
    // Resolves once on grid-engine's one-shot completion signal, success or not.
    moveTo(charId, targetPos) {
      cancelTrail(charId)

      // oxlint-disable-next-line promise/avoid-new
      return new Promise((resolve) => {
        gridEngine.moveTo(charId, targetPos).subscribe(({ result }) => {
          if (result) {
            console.warn(`[engine] moveTo(${charId} -> ${targetPos.x},${targetPos.y}) did not complete: ${result}`)
          }
          resolve()
        })
      })
    },

    // The Player trails the leader's route; any other follower chases by grid-engine's shortest path (adr/0027).
    follow(followerId, leaderId, gap) {
      const missing = [followerId, leaderId].filter((charId) => !gridEngine.hasCharacter(charId))
      if (missing.length > 0) {
        console.warn(`[engine] follow(${followerId} -> ${leaderId}) skipped: no character ${missing.join(', ')} on this Map`)
        return
      }
      cancelTrail(followerId)
      if (followerId === playerId) {
        trails.set(followerId, startTrail(followerId, leaderId, gap))
      } else {
        gridEngine.follow(followerId, leaderId, { distance: gap })
      }
    },

    // Cancel first, so a trail step interrupted here can't queue the next one.
    stopMovement(charId) {
      cancelTrail(charId)
      if (gridEngine.hasCharacter(charId)) {gridEngine.stopMovement(charId)}
    },

    // A non-blocking character still collides with walls; only character-vs-character collision is dropped.
    setBlocksCharacters(charId, blocks) {
      if (!gridEngine.hasCharacter(charId)) {
        console.warn(`[engine] setBlocksCharacters(${charId}) skipped: no character ${charId} on this Map`)
        return
      }
      gridEngine.setCollisionGroups(charId, blocks ? [CHARACTER_COLLISION_GROUP] : [])
    },
  }
}
