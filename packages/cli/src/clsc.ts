import type { Problem } from './problem.ts'
import { readFile } from 'node:fs/promises'

interface Mention {
  name: string
  path: string
  line: number
}

export interface ScriptFacts {
  speakers: string[]
  movers: string[]
  flags: string[]
  onceFlags: string[]
  characters: Mention[]
  cgs: Mention[]
  portraits: { speaker: string; expression: string; path: string; line: number }[]
  handlers: { trigger: 'interact' | 'enter'; id: string; path: string; line: number }[]
}

export type Compiled =
  | { fatal: string }
  | { problems: Problem[]; parsed: boolean; facts: ScriptFacts; bytecode: Uint8Array | undefined }

interface ClscExports {
  memory: WebAssembly.Memory
  alloc: (length: number) => number
  dealloc: (pointer: number, length: number) => void
  compile_world: (pointer: number, length: number) => number
}

interface WasmResult {
  fatal?: string
  diagnostics: { severity: 'error' | 'warning'; path: string; line: number; message: string }[]
  parsed: boolean
  facts: ScriptFacts
  hasBytecode: boolean
}

// The result buffer is `u32 total | u32 JSON length | JSON | bytecode`, little-endian (the compiler's `wasm.rs`).
const LENGTH_BYTES = 4
const HEADER_BYTES = 2 * LENGTH_BYTES

// Sits next to the bundle, copied there by the build (adr/0041).
async function instantiate(): Promise<ClscExports> {
  const { instance } = await WebAssembly.instantiate(await readFile(new URL('clsc.wasm', import.meta.url)))
  return instance.exports as unknown as ClscExports
}

function callCompiler(clsc: ClscExports, request: Uint8Array): { json: WasmResult; bytecode: Uint8Array } {
  const requestPointer = clsc.alloc(request.length)
  new Uint8Array(clsc.memory.buffer, requestPointer, request.length).set(request)
  const resultPointer = clsc.compile_world(requestPointer, request.length)

  // Read after the call: the compile may have grown the memory.
  const view = new DataView(clsc.memory.buffer, resultPointer)
  const total = view.getUint32(0, true)
  const jsonLength = view.getUint32(LENGTH_BYTES, true)
  const result = new Uint8Array(clsc.memory.buffer.slice(resultPointer + HEADER_BYTES, resultPointer + total))
  clsc.dealloc(requestPointer, request.length)
  clsc.dealloc(resultPointer, total)
  return { json: JSON.parse(new TextDecoder().decode(result.subarray(0, jsonLength))) as WasmResult, bytecode: result.subarray(jsonLength) }
}

/**
 * Compiles `sources` (paths relative to `root`) against the prelude bundled in the compiler. `root` only names the files in the diagnostics.
 */
export async function compileScripts(root: string, sources: [string, string][], strings: string | undefined): Promise<Compiled> {
  const request = new TextEncoder().encode(JSON.stringify({ root, sources, strings }))
  const { json, bytecode } = callCompiler(await instantiate(), request)
  if (json.fatal !== undefined) {
    return { fatal: json.fatal }
  }
  return {
    problems: json.diagnostics.map(({ severity, path, line, message }) => ({ severity, file: path, line, message })),
    parsed: json.parsed,
    facts: json.facts,
    bytecode: json.hasBytecode ? bytecode : undefined,
  }
}
