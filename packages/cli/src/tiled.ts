import { entries, isFile, isId, readJsonObject } from './files.ts'
import { mkdir, writeFile } from 'node:fs/promises'

const FACINGS = ['down', 'left', 'right', 'up']

interface Member {
  name: string
  type: 'string'
  propertyType?: string
  value: string
}

interface PropertyType {
  id?: number
  name: string
  [key: string]: unknown
}

interface Project {
  folders?: string[]
  propertyTypes?: PropertyType[]
  [key: string]: unknown
}

// The Characters in the Library: the folders under `library/characters/` that hold their sheet.
async function libraryCharacters(root: string): Promise<string[]> {
  const children = await entries(`${root}/library/characters`)
  const folders = children.filter((entry) => entry.isDirectory() && isId(entry.name))
  const found = await Promise.all(folders.map(async ({ name }) => ((await isFile(`${root}/library/characters/${name}/${name}.png`)) ? [name] : [])))
  return found.flat()
}

function text(name: string): Member {
  return { name, type: 'string', value: '' }
}

function choice(name: string, propertyType: string, value = ''): Member {
  return { name, type: 'string', propertyType, value }
}

function objectClass(name: string, members: Member[]): PropertyType {
  return { name, type: 'class', color: '#ffa0a0a4', drawFill: true, useAs: ['object'], members }
}

// Every custom type the Engine reads, as Tiled writes them. `Entity` and `Zone` carry the identity property the Engine looks objects up by (adr/0012); `Portal` has none yet, as the Engine reads nothing from it.
function generatedTypes(characters: string[]): PropertyType[] {
  return [
    { name: 'Facing', type: 'enum', storageType: 'string', valuesAsFlags: false, values: FACINGS },
    // The default stays blank: a default that matches would make Tiled omit the value and turn the Entity into a Prop Entity (adr/0024).
    { name: 'CharacterId', type: 'enum', storageType: 'string', valuesAsFlags: false, values: characters },
    objectClass('Entity', [text('entityId'), choice('characterId', 'CharacterId'), choice('facing', 'Facing', 'down')]),
    objectClass('Zone', [text('zoneId')]),
    objectClass('Portal', []),
  ]
}

// Replaces the generated types by name, keeping a type's id and every type the Author added. Fresh ids start after the highest in use.
function withTypes(existing: PropertyType[], generated: PropertyType[]): PropertyType[] {
  const names = new Set(generated.map(({ name }) => name))
  const kept = existing.filter(({ name }) => !names.has(name))
  const highest = Math.max(0, ...existing.map(({ id }) => id ?? 0))
  const known = new Map(existing.map(({ id, name }) => [name, id]))
  return [...kept, ...generated.map((type, index) => ({ ...type, id: known.get(type.name) ?? highest + 1 + index }))]
}

const FOLDERS = ['.', '../../library']

const WORLD_FOLDERS = ['cg', 'maps', 'portraits', 'scripts', 'tilesets']

// Placeholders to edit: a start Map and Character that don't exist yet, and one example string.
const STARTER_FILES: Record<string, object> = {
  'world.json': { startMap: 'start', spawn: { x: 1, y: 1 }, player: 'hero' },
  'strings.json': { locale: 'en', table: { en: { 'greeting.hello': 'Hello!' } } },
}

// `wx` fails on a file that is there, so an Author's edits are never overwritten.
async function writeStarter(file: string, body: object): Promise<void> {
  try {
    await writeFile(file, `${JSON.stringify(body, undefined, 2)}\n`, { flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {throw error}
  }
}

// The World's empty content folders and placeholder files that are missing, so a new World shows an Author where each file goes. The Library is the Author's to lay out (see the guide).
async function makeStarter(root: string, world: string): Promise<void> {
  const dir = `${root}/worlds/${world}`
  await Promise.all(WORLD_FOLDERS.map((folder) => mkdir(`${dir}/${folder}`, { recursive: true })))
  await Promise.all(Object.entries(STARTER_FILES).map(([name, body]) => writeStarter(`${dir}/${name}`, body)))
}

// The project's other settings stay; the generated types and the two project folders are refreshed.
function refreshed(project: Project, characters: string[]): Project {
  const folders = [...FOLDERS, ...(project.folders ?? []).filter((folder) => !FOLDERS.includes(folder))]
  return { ...project, folders, propertyTypes: withTypes(project.propertyTypes ?? [], generatedTypes(characters)) }
}

// The World's project as it is on disk, a new one when there is none, or why it can't be used.
async function currentProject(root: string, file: string): Promise<{ project: Project } | { reason: string }> {
  const read = await readJsonObject<Project>(`${root}/${file}`)
  if ('value' in read) {
    const { folders = [], propertyTypes = [] } = read.value
    return Array.isArray(folders) && Array.isArray(propertyTypes) ? { project: read.value } : { reason: `${file} needs "folders" and "propertyTypes" to be lists; fix or delete it and run again` }
  }
  return read.reason === 'does not exist' ? { project: { compatibilityVersion: 1100, extensionsPath: 'extensions' } } : { reason: `${file} ${read.reason}; fix or delete it and run again` }
}

// Writes `worlds/<world>/<world>.tiled-project`, creating the World folder and the empty folders of the content layout if they are missing. Returns the project's path, relative to the content root, or why it could not be written.
export async function writeTiledProject(root: string, world: string): Promise<{ file: string } | { reason: string }> {
  if (!isId(world)) {return { reason: `"${world}" is not a World id (ids are lower-case a-z, 0-9, - and _)` }}
  const file = `worlds/${world}/${world}.tiled-project`
  const current = await currentProject(root, file)
  if ('reason' in current) {return current}
  await makeStarter(root, world)
  const project = refreshed(current.project, await libraryCharacters(root))
  await writeFile(`${root}/${file}`, `${JSON.stringify(project, undefined, 2)}\n`)
  return { file }
}
