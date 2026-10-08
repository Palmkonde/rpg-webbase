import type { Context, Problem } from './problem.ts'
import type { MapInfo, Maps } from './maps.ts'
import type { CharacterRef } from './references.ts'
import { errorAt } from './problem.ts'
import { readJsonObject } from './files.ts'

interface WorldJson {
  startMap?: unknown
  spawn?: { x?: unknown; y?: unknown }
  player?: unknown
}

function startMapProblems(file: string, startMap: unknown, maps: Maps): Problem[] {
  if (typeof startMap !== 'string') {
    return [errorAt(file, 'needs a "startMap" Map id')]
  }
  const missing = !maps.byId.has(startMap) && maps.complete
  return missing ? [errorAt(file, `has the start Map "${startMap}", but ${file.replace('world.json', `maps/${startMap}.tmj`)} does not exist`)] : []
}

function spawnProblems(file: string, spawn: WorldJson['spawn'], start: MapInfo | undefined): Problem[] {
  const x = spawn?.x
  const y = spawn?.y
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) {
    return [errorAt(file, 'needs a "spawn" tile, { "x": 1, "y": 1 }')]
  }
  const inside = start === undefined || (x >= 0 && x < start.width && y >= 0 && y < start.height)
  return inside ? [] : [errorAt(file, `has the spawn tile (${x}, ${y}), outside Map "${start.id}", which is ${start.width}x${start.height} tiles`)]
}

async function readWorldJson(context: Context, file: string): Promise<{ json?: WorldJson; problems: Problem[] }> {
  const read = await readJsonObject<WorldJson>(`${context.root}/${file}`)
  return 'value' in read ? { json: read.value, problems: [] } : { problems: [errorAt(file, read.reason)] }
}

export async function worldJsonChecks(context: Context, maps: Maps): Promise<{ problems: Problem[]; characters: CharacterRef[] }> {
  const file = `worlds/${context.worldId}/world.json`
  const { json, problems } = await readWorldJson(context, file)
  if (json === undefined) {
    return { problems, characters: [] }
  }

  const start = typeof json.startMap === 'string' ? maps.byId.get(json.startMap) : undefined
  const player = typeof json.player === 'string' ? [{ id: json.player, file, who: 'has the player' }] : []
  return {
    problems: [
      ...startMapProblems(file, json.startMap, maps),
      ...spawnProblems(file, json.spawn, start),
      ...(typeof json.player === 'string' ? [] : [errorAt(file, 'needs a "player" Character id')]),
    ],
    characters: player,
  }
}
