import type { CgFrame, CgRegistry } from './cg.ts'
import type { ContentCatalogs, WorldConfig } from '@codeleagues-rpg-engine/engine-core'
import type { PortraitRegistry } from './portraits.ts'
import type { ServiceCalls } from './game-service.ts'
import type { StringTable } from './strings.ts'
import { parseStringTable } from './strings.ts'

// The manifest a World Version carries, as the Game Service serves it. Every `key` names a file under the version's `assetBaseUrl`.
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

export interface WorldVersion {
  id: string
  assetBaseUrl: string
  manifest: Manifest
}

// Every file URL is the version's base plus a key (adr/0042).
export function fileUrl({ assetBaseUrl }: WorldVersion, key: string): string {
  return assetBaseUrl + key
}

export function worldConfigOf({ manifest: { start } }: WorldVersion): WorldConfig {
  return { mapId: start.map, player: { spawn: start.spawn, characterId: start.player } }
}

export function catalogsOf(version: WorldVersion): ContentCatalogs {
  const { maps, characters } = version.manifest
  return {
    maps: Object.entries(maps).map(([id, key]) => ({ id, tiledMapUrl: fileUrl(version, key) })),
    characters: Object.entries(characters).map(([id, sheet]) => ({
      id,
      spriteUrl: fileUrl(version, sheet.key),
      frameWidth: sheet.frameWidth,
      frameHeight: sheet.frameHeight,
      offsetY: sheet.offsetY,
    })),
  }
}

export function portraitsOf(version: WorldVersion): PortraitRegistry {
  return Object.fromEntries(Object.entries(version.manifest.portraits).map(([speaker, expressions]) => [
    speaker,
    Object.fromEntries(Object.entries(expressions).map(([expression, key]) => [expression, fileUrl(version, key)])),
  ]))
}

// A frame's caption is the String Table key `cg.<id>.<n>`, counting from 1: the manifest lists art only.
export function cgsOf(version: WorldVersion): CgRegistry {
  return Object.fromEntries(Object.entries(version.manifest.cgs).map(([id, keys]) => [
    id,
    keys.map((key, index): CgFrame => ({ art: fileUrl(version, key), captionKey: `cg.${id}.${index + 1}` })),
  ]))
}

// What a session shows of the World Version it is pinned to (adr/0038): its String Table, and the URL of each Portrait and CG frame.
export interface WorldContent {
  strings: StringTable
  portraits: PortraitRegistry
  cgs: CgRegistry
}

export function contentOf(version: WorldVersion, strings: StringTable): WorldContent {
  return { strings, portraits: portraitsOf(version), cgs: cgsOf(version) }
}

// The live World Version is asked for once; every file after it comes from that version's own base URL (adr/0038).
export async function loadLiveWorld(calls: ServiceCalls): Promise<{ version: WorldVersion; scripts: Uint8Array; strings: StringTable }> {
  const version = await calls.readLiveVersion()
  const { scripts, strings } = version.manifest
  const [scriptBytes, stringBytes] = await Promise.all([scripts, strings].map((key) => calls.readFile(fileUrl(version, key))))
  return { version, scripts: scriptBytes, strings: parseStringTable(stringBytes) }
}
