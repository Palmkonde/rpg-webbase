import type { CommandArg, CommandHandler, Tile } from '@codeleagues-rpg-engine/clsc'
import type { EngineHandle } from '@codeleagues-rpg-engine/engine-core'
import { PLAYER_CHAR_ID } from '../state/player.ts'
import type { RefObject } from 'react'

// Always 0 in v1 (`docs/spec/clsc.md`).
const FOLLOW_GAP = 0

// `Player` is the language's name for the Player; every other Mover is a Character Entity id.
function moverId(name: CommandArg): string {
  return name === 'Player' ? PLAYER_CHAR_ID : name as string
}

// The Host's handlers for the commands `prelude.clsc` declares, calling the Engine's Movement and Follow APIs.
export class ScriptCommands {
  public readonly handlers: Readonly<Record<string, CommandHandler>> = {
    move: ([who, to]) => this.engine().moveTo(moverId(who), to as Tile),

    // Not awaited: grid-engine's follow never completes (adr/0025), so the follower is tracked for stopFollowers.
    follow: ([follower, leader]) => {
      const followerId = moverId(follower)
      this.engine().follow(followerId, moverId(leader), FOLLOW_GAP)
      this.followers.add(followerId)
    },
  }

  private readonly followers = new Set<string>()
  private readonly engineRef: RefObject<EngineHandle | undefined>

  public constructor(engineRef: RefObject<EngineHandle | undefined>) {
    this.engineRef = engineRef
  }

  // Stops every follower `follow` started; the Host calls it at unfreeze (adr/0030).
  public stopFollowers(): void {
    for (const followerId of this.followers) {this.engineRef.current?.stopMovement(followerId)}
    this.followers.clear()
  }

  // A throw here fails the command, which aborts the run.
  private engine(): EngineHandle {
    const engine = this.engineRef.current
    if (!engine) {throw new Error('A Script command ran with no Engine mounted')}
    return engine
  }
}
