import type { Context, Problem } from './problem.ts'
import { entries, isFile, readJsonObject } from './files.ts'
import { errorAt } from './problem.ts'

interface TiledProperty {
  name: string
  value: unknown
}

interface TiledObject {
  type?: string
  properties?: TiledProperty[]
}

interface TiledLayer {
  type: string
  name?: string
  compression?: string
  layers?: TiledLayer[]
  objects?: TiledObject[]
}

export interface TiledTileset {
  source?: string
  image?: string
  tiles?: { image?: string }[]
}

export interface TiledMap {
  width: number
  height: number
  tilewidth: number
  tileheight: number
  orientation?: string
  infinite?: boolean
  layers?: TiledLayer[]
  tilesets?: TiledTileset[]
}

export interface MapInfo {
  id: string
  width: number
  height: number
  entities: string[]
  zones: string[]

  // A `characterId` on an Entity.
  characters: string[]
}

export interface Maps {
  byId: Map<string, MapInfo>

  // False once a Map couldn't be read, since what it holds is then unknown.
  complete: boolean
}

interface LoadedMap {
  id: string
  file: string
  map?: TiledMap
  problems: Problem[]
}

interface ReadMap {
  id: string
  file: string
  map: TiledMap
}

function stringProperty({ properties }: TiledObject, name: string): string | undefined {
  const value = properties?.find((property) => property.name === name)?.value
  return typeof value === 'string' && value !== '' ? value : undefined
}

function layersIn(layers: TiledLayer[] | undefined): TiledLayer[] {
  const top = layers ?? []
  return [...top, ...top.flatMap((layer) => layersIn(layer.layers))]
}

function objectsIn(map: TiledMap): TiledObject[] {
  return layersIn(map.layers)
    .filter((layer) => layer.type === 'objectgroup')
    .flatMap((layer) => layer.objects ?? [])
}

// The objects of `kind` that carry their identity property, as the Engine reads them.
function objectsOfKind(map: TiledMap, kind: string, idProperty: string): TiledObject[] {
  return objectsIn(map).filter((object) => object.type === kind && stringProperty(object, idProperty) !== undefined)
}

// `tilesets/` here is a path segment, so `mytilesets/` is not an anchor.
function after(segments: string[], anchor: string[]): string | undefined {
  const starts = segments.map((_, start) => start).filter((start) => anchor.every((segment, offset) => segments[start + offset] === segment))
  const last = starts.at(-1)
  return last === undefined ? undefined : segments.slice(last + anchor.length).join('/')
}

/**
 * Where a tileset image path points inside the content root, by anchor (adr/0035): `library/tilesets/` is the Asset Library, any other
 * `tilesets/` is the World's own. Everything before the anchor is ignored.
 */
export function resolveTilesetImage(image: string, worldId: string): string | undefined {
  const segments = image.replaceAll('\\', '/').split('/')
  const library = after(segments, ['library', 'tilesets'])
  if (library !== undefined) {
    return `library/tilesets/${library}`
  }
  const own = after(segments, ['tilesets'])
  return own === undefined ? undefined : `worlds/${worldId}/tilesets/${own}`
}

async function imageProblem(context: Context, loaded: ReadMap, image: string): Promise<Problem[]> {
  const where = `Map "${loaded.id}" has the tileset image "${image}"`
  const resolved = resolveTilesetImage(image, context.worldId)
  if (resolved === undefined) {
    return [errorAt(loaded.file, `${where}, which has no library/tilesets/ or tilesets/ folder to resolve from`)]
  }
  const found = !resolved.split('/').includes('..') && (await isFile(`${context.root}/${resolved}`))
  return found ? [] : [errorAt(loaded.file, `${where}, but ${resolved} does not exist`)]
}

async function tilesetProblems(context: Context, loaded: ReadMap): Promise<Problem[]> {
  const tilesets = loaded.map.tilesets ?? []
  const external = tilesets
    .filter((tileset) => tileset.source !== undefined)
    .map((tileset) => errorAt(loaded.file, `Map "${loaded.id}" uses the external tileset "${tileset.source}"; embed it in the Map`))
  const images = [...tilesets.map((tileset) => tileset.image), ...tilesets.flatMap((tileset) => (tileset.tiles ?? []).map((tile) => tile.image))].filter((image) => image !== undefined)
  const missing = await Promise.all(images.map((image) => imageProblem(context, loaded, image)))
  return [...external, ...missing.flat()]
}

function structureProblems({ id, file, map }: ReadMap): Problem[] {
  const compressed = layersIn(map.layers).filter((layer) => layer.type === 'tilelayer' && layer.compression !== undefined && layer.compression !== '')
  return [
    ...(map.orientation === 'orthogonal' ? [] : [`is ${map.orientation ?? 'of no orientation'}, but only orthogonal Maps are supported`]),
    ...(map.infinite === true ? ['is infinite, but only fixed-size Maps are supported'] : []),
    ...compressed.map((layer) => `compresses the data of layer "${layer.name ?? ''}" (${layer.compression}); set Tile Layer Format to CSV or Base64 uncompressed`),
  ].map((message) => errorAt(file, `Map "${id}" ${message}`))
}

function describe({ id, map }: ReadMap): MapInfo {
  const entities = objectsOfKind(map, 'Entity', 'entityId')
  return {
    id,
    width: map.width,
    height: map.height,
    entities: entities.map((object) => stringProperty(object, 'entityId')).filter((value) => value !== undefined),
    zones: objectsOfKind(map, 'Zone', 'zoneId').map((object) => stringProperty(object, 'zoneId')).filter((value) => value !== undefined),
    characters: entities.map((object) => stringProperty(object, 'characterId')).filter((value) => value !== undefined),
  }
}

// An Entity or Zone id is unique within the World, not only within its Map, so the Engine's per-Map warning is not enough.
function duplicateProblems(maps: { file: string; info: MapInfo }[]): Problem[] {
  const first = new Map<string, string>()
  const claims = maps.flatMap(({ file, info }) => [
    ...info.entities.map((id) => ({ file, map: info.id, kind: 'Entity', id })),
    ...info.zones.map((id) => ({ file, map: info.id, kind: 'Zone', id })),
  ])
  return claims.flatMap(({ file, map, kind, id }) => {
    const other = first.get(`${kind} ${id}`)
    if (other === undefined) {
      first.set(`${kind} ${id}`, map)
      return []
    }
    return [errorAt(file, `Map "${map}" repeats the ${kind} id "${id}", already on Map "${other}"`)]
  })
}

function sizeOf({ map }: ReadMap): string {
  return `${map.tilewidth}x${map.tileheight}`
}

function tileSizeProblems(loaded: ReadMap[]): Problem[] {
  const [first] = loaded
  return loaded
    .filter((candidate) => sizeOf(candidate) !== sizeOf(first))
    .map((candidate) => errorAt(candidate.file, `Map "${candidate.id}" has ${sizeOf(candidate)} tiles, but Map "${first.id}" has ${sizeOf(first)}; every Map in a World shares one tile size`))
}

async function load(context: Context, dir: string, name: string): Promise<LoadedMap> {
  const file = `${dir}/${name}`
  const id = name.slice(0, -'.tmj'.length)
  const read = await readJsonObject<TiledMap>(`${context.root}/${file}`)
  return 'value' in read ? { id, file, map: read.value, problems: [] } : { id, file, problems: [errorAt(file, read.reason)] }
}

export async function checkMaps(context: Context): Promise<{ maps: Maps; problems: Problem[] }> {
  const dir = `worlds/${context.worldId}/maps`
  const children = await entries(`${context.root}/${dir}`)
  const names = children.filter((entry) => entry.isFile()).map((entry) => entry.name)
  const xml = names.filter((name) => name.endsWith('.tmx')).map((name) => errorAt(`${dir}/${name}`, 'is an XML Map; save it as JSON (.tmj) instead'))
  const loaded = await Promise.all(names.filter((name) => name.endsWith('.tmj')).map((name) => load(context, dir, name)))
  const read = loaded.filter((candidate): candidate is LoadedMap & ReadMap => candidate.map !== undefined)
  const perMap = await Promise.all(read.map((candidate) => tilesetProblems(context, candidate)))

  return {
    maps: { byId: new Map(read.map((candidate) => [candidate.id, describe(candidate)])), complete: xml.length === 0 && read.length === loaded.length },
    problems: [...xml, ...loaded.flatMap((candidate) => candidate.problems), ...read.flatMap((candidate) => structureProblems(candidate)), ...perMap.flat(), ...duplicateProblems(read.map((candidate) => ({ file: candidate.file, info: describe(candidate) }))), ...tileSizeProblems(read)],
  }
}
