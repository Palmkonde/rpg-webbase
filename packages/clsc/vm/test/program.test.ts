import { FORMAT_VERSION, loadProgram } from '../src/program.ts'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

// A fresh copy each call, so a test can patch a compiled header rather than hand-write bytecode. `npm test` compiles each `fixtures/<name>/` scripts root into `generated/<name>.clscb`.
async function compiled(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(new URL(`generated/${name}.clscb`, import.meta.url)))
}

test('an empty scripts root loads as a program with no handlers', async () => {
  assert.equal(loadProgram(await compiled('empty')).handlerCount, 0)
})

test('a file without the magic number is refused', async () => {
  const bytes = await compiled('empty')
  bytes[0] = 0
  assert.throws(() => loadProgram(bytes), { message: 'Not a clsc bytecode file: it doesn\'t start with "CLSC"' })
})

test('a file of another format version is refused with an error naming both versions', async () => {
  const bytes = await compiled('empty')
  new DataView(bytes.buffer).setUint16(4, FORMAT_VERSION + 1, true)
  assert.throws(() => loadProgram(bytes), {
    message: `The bytecode is format version ${FORMAT_VERSION + 1}, but this VM reads version ${FORMAT_VERSION}: rebuild it with \`clsc build\``,
  })
})

test('a truncated file is refused', async () => {
  const bytes = await compiled('empty')
  assert.throws(() => loadProgram(bytes.subarray(0, -1)), { message: `The bytecode is 9 bytes, but a version ${FORMAT_VERSION} file is 10: rebuild it with \`clsc build\`` })
})
