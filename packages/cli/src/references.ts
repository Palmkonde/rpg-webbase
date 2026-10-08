import type { Context, Problem } from './problem.ts'
import { errorAt, warningAt } from './problem.ts'
import { extensionOf, filesUnder, isFile, isRaw, readJsonObject } from './files.ts'
import type { Maps } from './maps.ts'
import type { ScriptFacts } from './clsc.ts'

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])

export interface CharacterRef {
  id: string
  file: string
  line?: number

  // Completes "<who> Character "id", but …".
  who: string
}

// The frame size and vertical offset of a Character's sheet, from `character.json` beside it.
export interface CharacterSheet {
  frameWidth: number
  frameHeight: number
  offsetY: number
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export async function readCharacterSheet(root: string, id: string): Promise<{ sheet: CharacterSheet } | { reason: string }> {
  const read = await readJsonObject<Partial<Record<keyof CharacterSheet, unknown>>>(`${root}/library/characters/${id}/character.json`)
  if ('reason' in read) {
    return read
  }
  const { frameWidth, frameHeight, offsetY = 0 } = read.value
  if (!isWholeNumber(frameWidth) || !isWholeNumber(frameHeight)) {
    return { reason: 'needs a whole-number "frameWidth" and "frameHeight" in pixels' }
  }
  return typeof offsetY === 'number' && Number.isFinite(offsetY) ? { sheet: { frameWidth, frameHeight, offsetY } } : { reason: '"offsetY" must be a number' }
}

async function hasSheet(context: Context, id: string): Promise<boolean> {
  return /^[a-z0-9_-]+$/u.test(id) && (await isFile(`${context.root}/library/characters/${id}/${id}.png`))
}

async function sheetProblem(context: Context, id: string): Promise<Problem[]> {
  const sheet = await readCharacterSheet(context.root, id)
  return 'reason' in sheet ? [errorAt(`library/characters/${id}/character.json`, sheet.reason)] : []
}

export async function characterProblems(context: Context, refs: CharacterRef[]): Promise<Problem[]> {
  const found = await Promise.all(refs.map(async (ref) => ({ ref, found: await hasSheet(context, ref.id) })))
  const missing = found
    .filter(({ found: isFound }) => !isFound)
    .map(({ ref: { id, file, line, who } }) => errorAt(file, `${who} Character "${id}", but library/characters/${id}/${id}.png does not exist`, line))
  const present = [...new Set(found.filter(({ found: isFound }) => isFound).map(({ ref }) => ref.id))]
  const unreadable = await Promise.all(present.map((id) => sheetProblem(context, id)))
  return [...missing, ...unreadable.flat()]
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
