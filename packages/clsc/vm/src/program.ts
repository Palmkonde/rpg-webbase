// The byte layout is documented, and owned, by the compiler's `bytecode.rs`.
const MAGIC = 'CLSC'
const VERSION_OFFSET = MAGIC.length
const HANDLER_COUNT_OFFSET = VERSION_OFFSET + Uint16Array.BYTES_PER_ELEMENT
const FILE_LENGTH = HANDLER_COUNT_OFFSET + Uint32Array.BYTES_PER_ELEMENT

// Hand-written, not generated from Rust: this is the layout this decoder reads, so a file from a newer or older compiler fails loudly.
export const FORMAT_VERSION = 1

export interface Program {
  readonly handlerCount: number
}

export function loadProgram(bytes: Uint8Array): Program {
  if (String.fromCodePoint(...bytes.subarray(0, MAGIC.length)) !== MAGIC) {
    throw new Error(`Not a clsc bytecode file: it doesn't start with "${MAGIC}"`)
  }

  // A Node Buffer can be a view into a larger pool, so the DataView must share its offset.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const version = view.getUint16(VERSION_OFFSET, true)
  if (version !== FORMAT_VERSION) {
    throw new Error(`The bytecode is format version ${version}, but this VM reads version ${FORMAT_VERSION}: rebuild it with \`clsc build\``)
  }
  if (bytes.byteLength !== FILE_LENGTH) {
    throw new Error(`The bytecode is ${bytes.byteLength} bytes, but a version ${FORMAT_VERSION} file is ${FILE_LENGTH}: rebuild it with \`clsc build\``)
  }
  return { handlerCount: view.getUint32(HANDLER_COUNT_OFFSET, true) }
}
