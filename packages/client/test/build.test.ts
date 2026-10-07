import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import type { InlineConfig } from 'tsdown'
import assert from 'node:assert/strict'
import { build } from 'tsdown'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { test } from 'node:test'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

// Inside the repo, so the build's runtime dependencies resolve from it as they would in a Platform's install.
const buildCache = fileURLToPath(new URL('../../../node_modules/.cache/', import.meta.url))

// A fresh directory for `body` to build into, removed afterwards.
async function withOutDir(body: (outDir: string) => Promise<void>): Promise<void> {
  await mkdir(buildCache, { recursive: true })
  const outDir = await mkdtemp(path.join(buildCache, 'client-build-'))
  try {
    await body(outDir)
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
}

async function buildPackage(outDir: string, overrides: InlineConfig = {}): Promise<void> {
  await build({ cwd: packageRoot, config: path.join(packageRoot, 'tsdown.config.ts'), outDir, logLevel: 'silent', ...overrides })
}

// Phaser throws on import outside a browser, so this fails if bundling hoists it out of the lazy Engine chunk.
test('the built package imports outside a browser, loading no Phaser', async () => {
  await withOutDir(async (outDir) => {
    await buildPackage(outDir)

    const client = await import(path.join(outDir, 'index.js'))

    assert.equal(typeof client.mount, 'function')
  })
})

const REACT_IMPORT = /from\s*["']react(?:-dom)?(?:\/[\w-]+)?["']/u

// React is an optional peer of `./react` only (adr/0039), so the core must load in a Platform without it.
test('only the react entry imports React', async () => {
  await withOutDir(async (outDir) => {
    await buildPackage(outDir)

    const outFiles = await readdir(outDir)
    const files = outFiles.filter((file) => file.endsWith('.js'))
    const importingReact = await Promise.all(files.map(async (file) => REACT_IMPORT.test(await readFile(path.join(outDir, file), 'utf8')) && file))

    assert.deepEqual(importingReact.filter(Boolean), ['react.js'])
  })
})

test('a public type from clsc fails the build', async () => {
  await withOutDir(async (outDir) => {
    const leaking = buildPackage(outDir, { entry: 'test/fixtures/leaked-types.ts' })

    await assert.rejects(leaking, /inline types from outside the client's own: .*packages\/clsc\//u)
  })
})

test('a public import of a package the client doesn\'t depend on fails the build', async () => {
  await withOutDir(async (outDir) => {
    const leaking = buildPackage(outDir, { entry: 'test/fixtures/leaked-types.ts', deps: { neverBundle: ['@codeleagues-rpg-engine/clsc'] } })

    await assert.rejects(leaking, /@codeleagues-rpg-engine\/clsc is imported in [\w-]+\.d\.ts/u)
  })
})
