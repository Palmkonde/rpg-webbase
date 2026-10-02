import type { Block, FlagDeclaration, Flags, Trigger } from './run.ts'
import { OPERAND_COUNTS } from './opcodes.ts'
import { Run } from './run.ts'

export type { Flags, Output, Run, ShownChoice, Trigger } from './run.ts'

// The byte layout is documented, and owned, by the compiler's `bytecode.rs`.
const MAGIC = 'CLSC'

// Hand-written, not generated from Rust: this is the layout this decoder reads, so a file from a newer or older compiler fails loudly.
export const FORMAT_VERSION = 3

// Decoded by position, as `bytecode.rs` writes them.
const TRIGGERS: readonly Trigger[] = ['interact', 'enter']
const BLOCK_KINDS: readonly Block['kind'][] = ['handler', 'cutscene']
const FLAG_TYPES = ['bool'] as const

const REBUILD = 'rebuild it with `clsc build`'

export interface Program {
  // A run of the handler for (trigger, id), or `undefined` when there's none.
  start: (trigger: Trigger, id: string, flags: Flags) => Run | undefined
}

class Reader {
  private readonly bytes: Uint8Array
  private readonly view: DataView
  private offset = 0

  public constructor(bytes: Uint8Array) {
    this.bytes = bytes

    // A Node Buffer can be a view into a larger pool, so the DataView must share its offset.
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  public get remaining(): number {
    return this.bytes.byteLength - this.offset
  }

  public take(length: number): Uint8Array {
    if (length > this.remaining) {
      throw new Error(`The bytecode is truncated: ${REBUILD}`)
    }
    this.offset += length
    return this.bytes.subarray(this.offset - length, this.offset)
  }

  public u8(): number {
    return this.take(Uint8Array.BYTES_PER_ELEMENT)[0]
  }

  public u16(): number {
    const start = this.offset
    this.take(Uint16Array.BYTES_PER_ELEMENT)
    return this.view.getUint16(start, true)
  }

  public u32(): number {
    const start = this.offset
    this.take(Uint32Array.BYTES_PER_ELEMENT)
    return this.view.getUint32(start, true)
  }

  // A u32 count, then that many entries.
  public list<T>(read: () => T): T[] {
    return Array.from({ length: this.u32() }, read)
  }
}

function readEnum<T>(table: readonly T[], index: number, what: string): T {
  if (index >= table.length) {
    throw new Error(`The bytecode has an unknown ${what} ${index}: ${REBUILD}`)
  }
  return table[index]
}

// The type is checked but not kept: `bool` is the only Flag type, so a run checks a stored value with `typeof`.
function readFlag(reader: Reader, strings: readonly string[]): FlagDeclaration {
  const name = strings[reader.u32()]
  readEnum(FLAG_TYPES, reader.u8(), 'Flag type')
  return { name, default: reader.u32() === 1 }
}

function readBlock(reader: Reader): Block {
  const kind = readEnum(BLOCK_KINDS, reader.u8(), 'block kind')

  // The block's name is only for `clsc disasm`.
  reader.u32()
  const code = reader.list(() => {
    const op = reader.u8()
    const operands = Array.from({ length: readEnum(OPERAND_COUNTS, op, 'opcode') }, () => reader.u32())
    return { op, operands }
  })
  return { kind, code }
}

function checkHeader(reader: Reader): void {
  if (new TextDecoder().decode(reader.take(Math.min(MAGIC.length, reader.remaining))) !== MAGIC) {
    throw new Error(`Not a clsc bytecode file: it doesn't start with "${MAGIC}"`)
  }

  const version = reader.u16()
  if (version !== FORMAT_VERSION) {
    throw new Error(`The bytecode is format version ${version}, but this VM reads version ${FORMAT_VERSION}: ${REBUILD}`)
  }
}

// Keyed by trigger and id together, so interact and enter keep separate namespaces.
function handlerKey(trigger: Trigger, id: string): string {
  return `${trigger} ${id}`
}

function readHandler(reader: Reader, strings: readonly string[], blocks: readonly Block[]): readonly [string, Block] {
  const trigger = readEnum(TRIGGERS, reader.u8(), 'trigger')
  return [handlerKey(trigger, strings[reader.u32()]), blocks[reader.u32()]]
}

export function loadProgram(bytes: Uint8Array): Program {
  const reader = new Reader(bytes)
  checkHeader(reader)

  const decoder = new TextDecoder('utf-8', { fatal: true })
  const strings = reader.list(() => decoder.decode(reader.take(reader.u32())))
  const flags = reader.list(() => readFlag(reader, strings))
  const blocks = reader.list(() => readBlock(reader))
  const handlers = new Map(reader.list(() => readHandler(reader, strings, blocks)))
  if (reader.remaining > 0) {
    throw new Error(`The bytecode has ${reader.remaining} unexpected bytes after its handler index: ${REBUILD}`)
  }

  return {
    start: (trigger, id, snapshot) => {
      const block = handlers.get(handlerKey(trigger, id))
      return block && new Run({ strings, flags, blocks }, block, snapshot)
    },
  }
}
