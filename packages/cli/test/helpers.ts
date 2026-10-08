import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { after } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'

const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url))

// A 1x1 transparent PNG: the content checks look at which files exist, never at pixels.
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

export type Files = Record<string, string | Buffer | undefined>

// `undefined` removes a file of the baseline, so a test states only what it changes.
export function world(changes: Files = {}): Files {
  const map = {
    width: 4,
    height: 4,
    tilewidth: 32,
    tileheight: 32,
    orientation: 'orthogonal',
    infinite: false,
    tilesets: [{ firstgid: 1, name: 'grass', image: '../../../library/tilesets/grass.png', tilewidth: 32, tileheight: 32 }],
    layers: [
      { type: 'tilelayer', name: 'ground', width: 4, height: 4, data: Array.from({ length: 16 }, () => 1) },
      {
        type: 'objectgroup',
        name: 'objects',
        objects: [
          { name: 'Sign', type: 'Entity', x: 64, y: 64, properties: [{ name: 'entityId', type: 'string', value: 'Sign' }] },
          { name: 'Gate', type: 'Zone', x: 0, y: 0, width: 32, height: 32, properties: [{ name: 'zoneId', type: 'string', value: 'Gate' }] },
        ],
      },
    ],
  }
  const script = `speaker Narrator;
speaker Sign;
character hero;
cg intro;

on interact(Sign) with Sign {
    Sign(Happy): "Hello";
}

on enter(Gate) with Narrator {
    Narrator: "Welcome";
}
`
  return {
    'library/characters/hero/hero.png': PNG,
    'library/characters/hero/character.json': JSON.stringify({ frameWidth: 16, frameHeight: 20, offsetY: -8 }),
    'library/tilesets/grass.png': PNG,
    'worlds/demo/world.json': JSON.stringify({ startMap: 'start', spawn: { x: 1, y: 1 }, player: 'hero' }),
    'worlds/demo/maps/start.tmj': JSON.stringify(map),
    'worlds/demo/scripts/story.clsc': script,
    'worlds/demo/portraits/Sign/happy.png': PNG,
    'worlds/demo/cg/intro/1.png': PNG,
    ...changes,
  }
}

// A map with `changes` merged over the baseline's, as the `.tmj` text.
export function mapWith(changes: Record<string, unknown>): string {
  return JSON.stringify({ ...JSON.parse(world()['worlds/demo/maps/start.tmj'] as string), ...changes })
}

const roots: string[] = []
after(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
})

export async function content(files: Files): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'crpg-'))
  roots.push(root)
  const written = Object.entries(files).filter((entry): entry is [string, string | Buffer] => entry[1] !== undefined)
  await Promise.all(
    written.map(async ([file, body]) => {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true })
      await writeFile(path.join(root, file), body)
    }),
  )
  return root
}

export interface Run {
  code: number | undefined
  output: string
}

const execFileAsync = promisify(execFile)

export interface CrpgOptions {
  runtime?: 'node' | 'bun'

  // Set over the test process's own environment.
  env?: Record<string, string>

  // What the command reads from stdin; a prompt gets end-of-input, which answers no, when this is left out.
  input?: string
}

export async function crpg(cwd: string, args: string[], { runtime = 'node', env = {}, input = '' }: CrpgOptions = {}): Promise<Run> {
  try {
    // oxlint-disable-next-line node/no-process-env -- the command reads GAME_SERVICE_URL and PUBLISH_KEY from it, so a test sets them over a copy.
    const running = execFileAsync(runtime, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } })
    running.child.stdin?.end(input)
    const { stdout, stderr } = await running
    return { code: 0, output: stdout + stderr }
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string }
    return { code: failed.code, output: `${failed.stdout ?? ''}${failed.stderr ?? ''}` }
  }
}

// The baseline World with `changes`, checked with `publish demo --dry-run` and no Game Service to compare with.
export async function check(changes: Files = {}): Promise<Run> {
  return crpg(await content(world(changes)), ['publish', 'demo', '--dry-run'], { env: { GAME_SERVICE_URL: '', PUBLISH_KEY: '' } })
}

// Every check is an error: the exit code is 1 and the output names the file and the reason.
export function expectError(run: Run, ...parts: string[]): void {
  assert.equal(run.code, 1, run.output)
  for (const part of parts) {
    assert.ok(run.output.includes(part), `expected "${part}" in:\n${run.output}`)
  }
}

export function expectPass(run: Run): void {
  assert.equal(run.code, 0, run.output)
}

// A Tiled object of `type` (Entity or Zone) whose id property is `id`.
export function tiledObject(type: 'Entity' | 'Zone', id: string, more: object[] = []): object {
  const property = type === 'Zone' ? 'zoneId' : 'entityId'
  return { name: id, type, x: 0, y: 0, width: 32, height: 32, properties: [{ name: property, type: 'string', value: id }, ...more] }
}

export function mapWithObjects(...objects: object[]): string {
  return mapWith({ layers: [{ type: 'objectgroup', name: 'objects', objects }] })
}

export function worldJson(changes: Record<string, unknown>): string {
  return JSON.stringify({ startMap: 'start', spawn: { x: 1, y: 1 }, player: 'hero', ...changes })
}

export function tilesetMap(image: string): string {
  return mapWith({ tilesets: [{ firstgid: 1, name: 't', image, tilewidth: 32, tileheight: 32 }] })
}

export const X = Buffer.from('x')
