import { IMAGE_EXTENSIONS, readCharacterSheet } from './references.ts'
import type { TiledMap, TiledTileset } from './maps.ts'
import { extensionOf, filesUnder, isFile, isRaw, readJsonObject, stemOf } from './files.ts'
import type { Checked } from './world.ts'
import type { Context } from './problem.ts'
import { createHash } from 'node:crypto'
import { portraitFiles } from './portraits.ts'
import { readFile } from 'node:fs/promises'
import { resolveTilesetImage } from './maps.ts'

// The World's table of contents (spec: "Packaging", the manifest shape); every value is a key, never a URL (adr/0034).
export interface Manifest {
  start: { map: string; spawn: { x: number; y: number }; player: string }
  maps: Record<string, string>
  characters: Record<string, { key: string; frameWidth: number; frameHeight: number; offsetY: number }>
  portraits: Record<string, Record<string, string>>
  cgs: Record<string, string[]>
  scripts: string
  strings: string
  entities: string[]
  files: string[]
}

export interface Bundle {
  manifest: Manifest

  // Every file the World uses, by its key.
  files: Map<string, Buffer>
}

interface WorldJson {
  startMap: string
  spawn: { x: number; y: number }
  player: string
}

// A String Table with one empty Locale, for a World that has no `strings.json`.
const EMPTY_STRINGS = JSON.stringify({ locale: 'en', table: { en: {} } })

interface Store {
  add: (bytes: Uint8Array, extension: string) => string
  addFile: (path: string) => Promise<string>
  files: Map<string, Buffer>
}

// A file's key is `<sha256>.<extension>` (adr/0034), so the same bytes are one file however many times the World uses them.
function createStore(root: string): Store {
  const files = new Map<string, Buffer>()
  function add(bytes: Uint8Array, extension: string): string {
    const key = `${createHash('sha256').update(bytes).digest('hex')}.${extension}`
    files.set(key, Buffer.from(bytes))
    return key
  }
  async function addFile(path: string): Promise<string> {
    return add(await readFile(`${root}/${path}`), extensionOf(path))
  }
  return { add, addFile, files }
}


async function tilesetKey(context: Context, store: Store, image: string): Promise<string> {
  const resolved = resolveTilesetImage(image, context.worldId)
  if (resolved === undefined) {
    throw new Error(`the tileset image "${image}" has no library/tilesets/ or tilesets/ folder to resolve from`)
  }
  return store.addFile(resolved)
}

async function rewriteTileset(context: Context, store: Store, tileset: TiledTileset): Promise<TiledTileset> {
  const image = tileset.image === undefined ? {} : { image: await tilesetKey(context, store, tileset.image) }
  const tiles = tileset.tiles === undefined
    ? {}
    : { tiles: await Promise.all(tileset.tiles.map(async (tile) => (tile.image === undefined ? tile : { ...tile, image: await tilesetKey(context, store, tile.image) }))) }
  return { ...tileset, ...image, ...tiles }
}

// The Map with every tileset image path replaced by its file's key; the Map is hashed after that, so its key changes with its art (adr/0040).
async function mapKey(context: Context, store: Store, id: string): Promise<string> {
  const read = await readJsonObject<TiledMap>(`${context.root}/worlds/${context.worldId}/maps/${id}.tmj`)
  if ('reason' in read) {
    throw new Error(`Map "${id}" ${read.reason}`)
  }
  const tilesets = await Promise.all((read.value.tilesets ?? []).map((tileset) => rewriteTileset(context, store, tileset)))
  return store.add(Buffer.from(JSON.stringify({ ...read.value, tilesets })), 'tmj')
}

async function characterEntry(context: Context, store: Store, id: string): Promise<[string, Manifest['characters'][string]]> {
  const read = await readCharacterSheet(context.root, id)
  if ('reason' in read) {
    throw new Error(`Character "${id}" ${read.reason}`)
  }
  return [id, { key: await store.addFile(`library/characters/${id}/${id}.png`), ...read.sheet }]
}

// The prelude's Expressions are capitalized, and the files are named in lower case (`happy.png`).
function expressionOf(fileName: string): string {
  const stem = stemOf(fileName)
  return `${stem.slice(0, 1).toUpperCase()}${stem.slice(1)}`
}

async function portraitsOf(context: Context, store: Store): Promise<Manifest['portraits']> {
  const found = await portraitFiles(context)
  const keyed = await Promise.all(found.map(async ({ speaker, fileName }) => ({ speaker, expression: expressionOf(fileName), key: await store.addFile(`worlds/${context.worldId}/portraits/${speaker}/${fileName}`) })))
  const bySpeaker: Manifest['portraits'] = {}
  for (const { speaker, expression, key } of keyed) {
    bySpeaker[speaker] = { ...bySpeaker[speaker], [expression]: key }
  }
  return bySpeaker
}

// Frames in the order a CG plays them: `2.png` before `10.png`.
async function cgFrames(context: Context, store: Store, name: string): Promise<string[]> {
  const dir = `worlds/${context.worldId}/cg/${name}`
  const found = await filesUnder(`${context.root}/${dir}`)
  const files = found.filter((file) => !isRaw(file) && IMAGE_EXTENSIONS.has(extensionOf(file)))
  return Promise.all(files.toSorted((a, b) => a.localeCompare(b, 'en', { numeric: true })).map((file) => store.addFile(`${dir}/${file}`)))
}

async function stringsKey(context: Context, store: Store): Promise<string> {
  const file = `worlds/${context.worldId}/strings.json`
  return (await isFile(`${context.root}/${file}`)) ? store.addFile(file) : store.add(Buffer.from(EMPTY_STRINGS), 'json')
}

async function entries<Value>(names: string[], read: (name: string) => Promise<Value>): Promise<Record<string, Value>> {
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name, await read(name)] as const)))
}

async function startOf(context: Context): Promise<Manifest['start']> {
  const read = await readJsonObject<WorldJson>(`${context.root}/worlds/${context.worldId}/world.json`)
  if ('reason' in read) {
    throw new Error(`world.json ${read.reason}`)
  }
  const { startMap, spawn, player } = read.value
  return { map: startMap, spawn, player }
}

// A World that passed the checks always has bytecode, even with no Scripts; none means the checks and the bundle disagree.
function requireBytecode({ bytecode }: Checked): Uint8Array {
  if (bytecode === undefined) {
    throw new Error('the Scripts compiled to no bytecode, though the checks found no error')
  }
  return bytecode
}

async function contentOf(context: Context, checked: Checked, store: Store): Promise<Omit<Manifest, 'files'>> {
  return {
    start: await startOf(context),
    maps: await entries([...checked.maps.byId.keys()], (id) => mapKey(context, store, id)),
    characters: Object.fromEntries(await Promise.all(checked.characterIds.map((id) => characterEntry(context, store, id)))),
    portraits: await portraitsOf(context, store),
    cgs: await entries(checked.cgs, (name) => cgFrames(context, store, name)),
    scripts: store.add(requireBytecode(checked), 'clscb'),
    strings: await stringsKey(context, store),
    entities: [...checked.maps.byId.values()].flatMap((map) => map.entities),
  }
}

/**
 * Gathers the files a checked World uses and the manifest that names them. `checked` has no errors, so everything it names exists.
 */
export async function bundleWorld(context: Context, checked: Checked): Promise<Bundle> {
  const store = createStore(context.root)
  const content = await contentOf(context, checked, store)
  return { manifest: { ...content, files: [...store.files.keys()].toSorted() }, files: store.files }
}
