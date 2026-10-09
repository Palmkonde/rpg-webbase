import { PNG, content, crpg, expectError, expectPass, world } from './helpers.ts'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

interface Member { name: string; type: string; propertyType?: string; value: unknown }
interface PropertyType { id: number; name: string; type: string; values?: string[]; members?: Member[]; useAs?: string[] }
interface Project { folders: string[]; propertyTypes: PropertyType[]; [key: string]: unknown }

const PROJECT = 'worlds/demo/demo.tiled-project'

async function readProject(root: string): Promise<Project> {
  const text = await readFile(`${root}/${PROJECT}`, 'utf8')
  return JSON.parse(text) as Project
}

function typeNamed(project: Project, name: string): PropertyType {
  const found = project.propertyTypes.find((type) => type.name === name)
  assert.ok(found, `no custom type "${name}"`)
  return found
}

// Two Characters in the Library, plus a folder with no sheet that is not one.
const LIBRARY = {
  'library/characters/hero/hero.png': PNG,
  'library/characters/fluffy/fluffy.png': PNG,
  'library/characters/stray/notes.txt': 'x',
}

test('a new World gets its folder and a Tiled project with the Library as a project folder', async () => {
  const root = await content(LIBRARY)
  expectPass(await crpg(root, ['tiled', 'demo']))
  const project = await readProject(root)
  assert.deepEqual(project.folders, ['.', '../../library'])
})

test('a new World gets its empty content folders and the Library is left alone', async () => {
  const root = await content({})
  expectPass(await crpg(root, ['tiled', 'demo']))
  const worldFolder = await readdir(`${root}/worlds/demo`)
  assert.deepEqual(worldFolder.toSorted(), ['cg', 'demo.tiled-project', 'maps', 'portraits', 'scripts', 'strings.json', 'tilesets', 'world.json'])
  assert.deepEqual(await readdir(root), ['worlds'])
})

test('a new World gets a placeholder world.json and strings.json the Publish checks accept', async () => {
  const root = await content({})
  await crpg(root, ['tiled', 'demo'])
  const worldJson = JSON.parse(await readFile(`${root}/worlds/demo/world.json`, 'utf8')) as Record<string, unknown>
  assert.deepEqual(Object.keys(worldJson).toSorted(), ['player', 'spawn', 'startMap'])
  const run = await crpg(root, ['publish', 'demo', '--dry-run'], { env: { GAME_SERVICE_URL: '', PUBLISH_KEY: '' } })
  assert.ok(!run.output.includes('strings.json'), run.output)
})

test('re-running leaves a world.json and strings.json the Author has edited alone', async () => {
  const root = await content({ 'worlds/demo/world.json': '{"mine":1}', 'worlds/demo/strings.json': '{"mine":2}' })
  expectPass(await crpg(root, ['tiled', 'demo']))
  assert.equal(await readFile(`${root}/worlds/demo/world.json`, 'utf8'), '{"mine":1}')
  assert.equal(await readFile(`${root}/worlds/demo/strings.json`, 'utf8'), '{"mine":2}')
})

test('the project defines every custom type the Engine reads', async () => {
  const root = await content(LIBRARY)
  await crpg(root, ['tiled', 'demo'])
  const project = await readProject(root)
  assert.deepEqual(project.propertyTypes.map(({ name }) => name).toSorted(), ['CharacterId', 'Entity', 'Facing', 'Portal', 'Zone'])
  assert.deepEqual(typeNamed(project, 'Facing').values, ['down', 'left', 'right', 'up'])
  assert.equal(new Set(project.propertyTypes.map(({ id }) => id)).size, project.propertyTypes.length)
  assert.deepEqual(typeNamed(project, 'Zone').members?.map(({ name }) => name), ['zoneId'])
  assert.deepEqual(typeNamed(project, 'Entity').useAs, ['object'])
})

test('CharacterId lists the Characters in the Library, and Entity picks from it with a blank default', async () => {
  const root = await content(LIBRARY)
  await crpg(root, ['tiled', 'demo'])
  const project = await readProject(root)
  assert.deepEqual(typeNamed(project, 'CharacterId').values, ['fluffy', 'hero'])
  const members = typeNamed(project, 'Entity').members ?? []
  assert.deepEqual(members.find(({ name }) => name === 'characterId'), { name: 'characterId', type: 'string', propertyType: 'CharacterId', value: '' })
  assert.deepEqual(members.find(({ name }) => name === 'facing'), { name: 'facing', type: 'string', propertyType: 'Facing', value: 'down' })
  assert.deepEqual(members.find(({ name }) => name === 'entityId'), { name: 'entityId', type: 'string', value: '' })
})

test('re-running adds new Characters and leaves Maps alone', async () => {
  const root = await content({ ...LIBRARY, ...world() })
  await crpg(root, ['tiled', 'demo'])
  const mapBefore = await readFile(`${root}/worlds/demo/maps/start.tmj`, 'utf8')
  await mkdir(`${root}/library/characters/zed`)
  await writeFile(`${root}/library/characters/zed/zed.png`, PNG)

  expectPass(await crpg(root, ['tiled', 'demo']))
  assert.equal(await readFile(`${root}/worlds/demo/maps/start.tmj`, 'utf8'), mapBefore)
  assert.deepEqual(typeNamed(await readProject(root), 'CharacterId').values, ['fluffy', 'hero', 'zed'])
})

// A content folder whose World already has a project that the Author has added a folder, a type and a setting to.
async function editedWorld(): Promise<string> {
  const root = await content(LIBRARY)
  await crpg(root, ['tiled', 'demo'])
  const edited = await readProject(root)
  edited.folders.push('../../extras')
  edited.propertyTypes.push({ id: 99, name: 'Mine', type: 'enum', values: ['a'] })
  edited.tilesetFolder = 'tilesets'
  await writeFile(`${root}/${PROJECT}`, JSON.stringify(edited))
  return root
}

test('re-running keeps the Author’s own folders, types, settings and type ids', async () => {
  const root = await editedWorld()
  const entityId = typeNamed(await readProject(root), 'Entity').id

  expectPass(await crpg(root, ['tiled', 'demo']))
  const after = await readProject(root)
  assert.deepEqual(after.folders, ['.', '../../library', '../../extras'])
  assert.equal(after.tilesetFolder, 'tilesets')
  assert.equal(typeNamed(after, 'Mine').id, 99)
  assert.equal(typeNamed(after, 'Entity').id, entityId)
  assert.equal(new Set(after.propertyTypes.map(({ id }) => id)).size, after.propertyTypes.length)
})

test('a project file that is not JSON is refused and left as it was', async () => {
  const root = await content({ ...LIBRARY, [PROJECT]: 'not json' })
  expectError(await crpg(root, ['tiled', 'demo']), PROJECT, 'not valid JSON')
  assert.equal(await readFile(`${root}/${PROJECT}`, 'utf8'), 'not json')
})

test('a project whose folders are not a list is refused', async () => {
  const root = await content({ ...LIBRARY, [PROJECT]: '{"folders":"x"}' })
  expectError(await crpg(root, ['tiled', 'demo']), PROJECT, 'lists')
})

test('tiled without exactly one World prints the usage', async () => {
  const run = await crpg(await content(LIBRARY), ['tiled'])
  assert.notEqual(run.code, 0)
  assert.match(run.output, /Usage: crpg publish/u)
})

test('a World id outside a-z, 0-9, - and _ is refused', async () => {
  expectError(await crpg(await content(LIBRARY), ['tiled', '../demo']), 'is not a World id')
})
