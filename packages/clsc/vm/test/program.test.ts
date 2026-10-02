import { FORMAT_VERSION, loadProgram } from '../src/program.ts'
import assert from 'node:assert/strict'
import { compiled } from './helpers.ts'
import { test } from 'node:test'

const REBUILD = 'rebuild it with `clsc build`'

test('an empty scripts root loads as a program with no handlers', async () => {
  assert.equal(loadProgram(await compiled('empty'), {}).start('enter', 'Camp', {}), undefined)
})

test('a file without the magic number is refused', async () => {
  const bytes = await compiled('empty')
  bytes[0] = 0
  assert.throws(() => loadProgram(bytes, {}), { message: 'Not a clsc bytecode file: it doesn\'t start with "CLSC"' })
})

test('a file of another format version is refused with an error naming both versions', async () => {
  const bytes = await compiled('empty')
  new DataView(bytes.buffer).setUint16(4, FORMAT_VERSION + 1, true)
  assert.throws(() => loadProgram(bytes, {}), {
    message: `The bytecode is format version ${FORMAT_VERSION + 1}, but this VM reads version ${FORMAT_VERSION}: ${REBUILD}`,
  })
})

test('a truncated file is refused', async () => {
  const bytes = await compiled('basics')
  assert.throws(() => loadProgram(bytes.subarray(0, -1), {}), { message: `The bytecode is truncated: ${REBUILD}` })
})

test('a file with bytes after its handler index is refused', async () => {
  const bytes = await compiled('basics')
  assert.throws(() => loadProgram(new Uint8Array([...bytes, 0]), {}), { message: `The bytecode has 1 unexpected bytes after its handler index: ${REBUILD}` })
})

test('a Flag of an unknown type is refused', async () => {
  const bytes = await compiled('one-flag')

  // Magic, version, the pool holding "lit", the Flag count and its name come first.
  bytes[4 + 2 + 4 + 4 + 3 + 4 + 4] = 2
  assert.throws(() => loadProgram(bytes, {}), { message: `The bytecode has an unknown Flag type 2: ${REBUILD}` })
})
