import type { RolldownChunk } from 'tsdown'
import { defineConfig } from 'tsdown'
import { fileURLToPath } from 'node:url'
import pkg from './package.json' with { type: 'json' }

const preactLicense = fileURLToPath(new URL('LICENSE', import.meta.resolve('preact/package.json')))

// Engine-core is here only for the World Config and catalogs `WorldContent` carries, until the Game Service serves them.
const PUBLIC_TYPE_SOURCES = ['./src/', '../engine-core/src/'].map((dir) => fileURLToPath(new URL(dir, import.meta.url)))

type CodeChunk = Extract<RolldownChunk, { type: 'chunk' }>

function isDeclarationChunk(chunk: RolldownChunk): chunk is CodeChunk {
  return chunk.type === 'chunk' && chunk.fileName.endsWith('.d.ts')
}

// Bundled workspace packages are inlined into the `.d.ts`, not imported, so `onlyImport` can't see a clsc or Game Service type that leaks (adr/0037).
function checkPublicTypeSources({ chunks }: { chunks: RolldownChunk[] }): void {
  const leaked = chunks
    .filter((chunk) => isDeclarationChunk(chunk))
    .flatMap((chunk) => Object.entries(chunk.modules))
    .filter(([id, { renderedLength }]) => renderedLength > 0 && !PUBLIC_TYPE_SOURCES.some((dir) => id.startsWith(dir)))
    .map(([id]) => id)
  if (leaked.length > 0) {
    throw new Error(`The public types inline types from outside the client's own: ${leaked.join(', ')}`)
  }
}

export default defineConfig({
  entry: 'src/index.ts',
  format: 'esm',
  platform: 'browser',

  // Oxc, since the tsgo generator can't emit the sibling workspace packages whose types get inlined.
  dts: { generator: 'oxc' },
  deps: {
    onlyBundle: ['preact'],

    // Checked in the `.d.ts` too: an import of the Game Service or a private workspace package would point a stranger's install at a package that's never published (adr/0037).
    onlyImport: Object.keys(pkg.dependencies),
  },

  // Otherwise the `.d.ts` keeps a bare `import "phaser"` left over from the inlined engine-core types.
  treeshake: { moduleSideEffects: (_id: string, external: boolean) => !external },

  // Preact is bundled in, so its notice ships with it (adr/0043).
  copy: [{ from: preactLicense, rename: 'preact.LICENSE' }],

  hooks: { 'build:done': checkPublicTypeSources },
})
