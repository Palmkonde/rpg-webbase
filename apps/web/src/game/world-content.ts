import type { CgArtRegistry, CgFrame, CgRegistry, PortraitRegistry, WorldContent } from '@codeleagues-rpg-engine/client'
import { characters, maps } from './catalogs.ts'
import strings from '../fixtures/strings.json' with { type: 'json' }

const SCRIPTS_URL = '/generated/scripts.clscb'

const INTRO_FRAMES: CgFrame[] = [
  { art: 'intro-1', captionKey: 'cg.intro.1' },
  { art: 'intro-2', captionKey: 'cg.intro.2' },
  { art: 'intro-3', captionKey: 'cg.intro.3' },
]

// Not in scripts/: per GLOSSARY.md a Script runs for an Entity/Map Event — a CG has neither.
const cgs = {
  campfire_vision: INTRO_FRAMES,
} satisfies CgRegistry

const cgArt = {
  'intro-1': '/assets/cg/intro/1.jpg',
  'intro-2': '/assets/cg/intro/2.jpg',
  'intro-3': '/assets/cg/intro/3.jpg',
} satisfies CgArtRegistry

const portraits = {
  Campfire: {
    Neutral: '/assets/portraits/campfire/neutral.png',
    Happy: '/assets/portraits/campfire/happy.png',
    Sad: '/assets/portraits/campfire/sad.png',
  },
  Narrator: {
    Sad: '/assets/portraits/narrator/sad.png',
  },
} satisfies PortraitRegistry

// Fetched once per session, the same way Maps are (adr/0032); a missing file fails startup.
async function loadScripts(): Promise<Uint8Array> {
  const response = await fetch(SCRIPTS_URL)
  if (!response.ok) {
    throw new Error(`Script bytecode ${SCRIPTS_URL} is missing (HTTP ${response.status}): run \`bun run dev\`, or \`bun run clsc\` in apps/web`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

// The hard-coded stand-in for a World Version, until the Game Service serves one.
export const worldContent: Omit<WorldContent, 'worldConfig'> = {
  catalogs: { maps, characters },
  loadScripts,
  strings: strings.table,
  portraits,
  cgs,
  cgArt,
}

// The fixture-stubbed Locale, until the Platform passes one.
export const locale: string = strings.locale
