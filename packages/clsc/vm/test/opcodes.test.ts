import { Opcode } from '../src/opcodes.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('the generated opcodes give Return the first byte of the Rust opcode table', () => {
  assert.equal(Opcode.Return, 0)
})
