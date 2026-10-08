import type { Checked } from './world.ts'

// What a World Version declares that Students' stored Flags depend on (adr/0038); stored with the version for the next Publish's report.
export interface Summary {
  flags: string[]
  onceFlags: string[]
  companions: string[]
  zones: string[]
  entities: string[]
}

type Listed = Exclude<keyof Summary, 'entities'>

const LISTED: [Listed, string][] = [
  ['flags', 'Flags'],
  ['onceFlags', 'Once-only Cutscene Flags'],
  ['companions', 'Companion movers'],
  ['zones', 'Zones'],
]

export function summaryOf({ facts, maps }: Checked): Summary {
  return {
    flags: facts?.flags ?? [],
    onceFlags: facts?.onceFlags ?? [],
    companions: facts?.movers ?? [],
    zones: [...new Set((facts?.handlers ?? []).filter(({ trigger }) => trigger === 'enter').map(({ id }) => id))],
    entities: [...maps.byId.values()].flatMap((map) => map.entities),
  }
}

function stringsIn(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

// A stored summary may be `{}`, which reads as empty.
export function readSummary(stored: unknown): Summary {
  const fields = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {}
  return { flags: stringsIn(fields.flags), onceFlags: stringsIn(fields.onceFlags), companions: stringsIn(fields.companions), zones: stringsIn(fields.zones), entities: stringsIn(fields.entities) }
}

export interface Report {
  text: string

  // Whether the new World Version adds or removes anything, which is what makes the Author confirm.
  changed: boolean
}

function section(title: string, live: string[], next: string[]): string[] {
  const added = next.filter((name) => !live.includes(name)).map((name) => `  + ${name}`)
  const removed = live.filter((name) => !next.includes(name)).map((name) => `  - ${name}`)
  return added.length + removed.length === 0 ? [] : [`${title}:`, ...added, ...removed]
}

// A renamed Flag is one removal and one addition: that is how it reaches Students (adr/0038).
export function reportOf(live: Summary, next: Summary): Report {
  const changes = LISTED.flatMap(([field, title]) => section(title, live[field], next[field]))
  const unplaced = next.companions.filter((mover) => !next.entities.includes(mover))
  const warning = unplaced.length === 0 ? [] : [`Movers with no Entity on any Map: ${unplaced.join(', ')}`]
  const intro = changes.length === 0 ? [] : ["Students' stored Flags are never migrated: a removed Flag, Zone or Companion mover starts over if it comes back, and a renamed one starts over now."]
  return { text: [...intro, ...changes, ...warning].join('\n'), changed: changes.length > 0 }
}
