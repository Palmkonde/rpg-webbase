import type { Context, Problem } from './problem.ts'
import { errorAt, warningAt } from './problem.ts'
import { extensionOf, filesUnder, isFile, isRaw } from './files.ts'
import type { Maps } from './maps.ts'
import type { ScriptFacts } from './clsc.ts'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])

export interface CharacterRef {
  id: string
  file: string
  line?: number

  // Completes "<who> Character "id", but …".
  who: string
}

export async function characterProblems(context: Context, refs: CharacterRef[]): Promise<Problem[]> {
  const checked = await Promise.all(
    refs.map(async ({ id, file, line, who }) => {
      const found = /^[a-z0-9_-]+$/u.test(id) && (await isFile(`${context.root}/library/characters/${id}/${id}.png`))
      return found ? [] : [errorAt(file, `${who} Character "${id}", but library/characters/${id}/${id}.png does not exist`, line)]
    }),
  )
  return checked.flat()
}

// A declared CG is a CG the World needs, so it must hold at least one frame.
export async function cgProblems(context: Context, facts: ScriptFacts): Promise<Problem[]> {
  const checked = await Promise.all(
    facts.cgs.map(async ({ name, path, line }) => {
      const files = await filesUnder(`${context.root}/worlds/${context.worldId}/cg/${name}`)
      const frames = files.filter((file) => !isRaw(file) && IMAGE_EXTENSIONS.has(extensionOf(file)))
      return frames.length > 0 ? [] : [errorAt(path, `declares the CG "${name}", but worlds/${context.worldId}/cg/${name}/ holds no image`, line)]
    }),
  )
  return checked.flat()
}

function isOnAMap(maps: Maps, trigger: string, id: string): boolean {
  return [...maps.byId.values()].some((map) => (trigger === 'interact' ? map.entities : map.zones).includes(id))
}

// Only a warning: the handler may be waiting on a Map that isn't finished yet.
export function handlerProblems(facts: ScriptFacts, maps: Maps): Problem[] {
  if (!maps.complete) {
    return []
  }
  return facts.handlers
    .filter(({ trigger, id }) => !isOnAMap(maps, trigger, id))
    .map(({ trigger, id, path, line }) => warningAt(path, `on ${trigger}(${id}) names ${trigger === 'interact' ? 'an Entity' : 'a Zone'} that is on no Map`, line))
}
