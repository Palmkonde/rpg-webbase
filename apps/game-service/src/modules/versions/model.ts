/* oxlint-disable new-cap -- TypeBox's builders are capitalized functions, not constructors. */
import { t } from 'elysia'

// `<sha256 hex>.<extension>` (adr/0034): the same shape the blob routes accept.
const key = t.String({ pattern: '^[0-9a-f]{64}\\.[a-z0-9]{1,16}$' })

const spawn = t.Object({ x: t.Integer(), y: t.Integer() })
const start = t.Object({ map: t.String(), spawn, player: t.String() })
const character = t.Object({ key, frameWidth: t.Integer(), frameHeight: t.Integer(), offsetY: t.Number() })
const expressions = t.Record(t.String(), key)

// The manifest as the spec gives it. Portrait Expressions and Character ids stay open strings: the CLI has already checked them.
const manifest = t.Object({
  start,
  maps: t.Record(t.String(), key),
  characters: t.Record(t.String(), character),
  portraits: t.Record(t.String(), expressions),
  cgs: t.Record(t.String(), t.Array(key)),
  scripts: key,
  strings: key,
  entities: t.Array(t.String()),
  files: t.Array(key),
})

export type Manifest = typeof manifest.static

export const VersionsModel = {
  commit: t.Object({
    manifest,
    summary: t.Record(t.String(), t.Unknown()),

    // The World Version the Author's report was computed against; absent for a World's first Publish.
    expectedLive: t.Optional(t.String({ format: 'uuid' })),
  }),
}

export type Commit = typeof VersionsModel.commit.static
