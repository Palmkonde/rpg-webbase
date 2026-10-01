import { Opcode } from './opcodes.ts'

export type Trigger = 'interact' | 'enter'

export type Flags = Readonly<Record<string, boolean | number | string>>

export type Output =
  | { type: 'line'; speaker: string; expression: string; text: string }
  | { type: 'freeze' }
  | { type: 'unfreeze' }
  | { type: 'done' }

export interface Instruction {
  op: number
  operands: number[]
}

export interface Block {
  kind: 'handler' | 'cutscene'
  code: Instruction[]
}

interface Frame {
  block: Block
  pc: number
}

// One run of a handler (adr/0030): each next() executes until the next output and hands it back, never awaiting anything.
export class Run {
  private readonly strings: readonly string[]
  private readonly blocks: readonly Block[]
  private readonly stack: Frame[]

  // The Player is frozen exactly while this is above zero.
  private cutsceneFrames = 0

  public constructor(strings: readonly string[], blocks: readonly Block[], handler: Block) {
    this.strings = strings
    this.blocks = blocks
    this.stack = [{ block: handler, pc: 0 }]
  }

  public next(): Output {
    for (let frame = this.stack.at(-1); frame; frame = this.stack.at(-1)) {
      const { op, operands } = frame.block.code[frame.pc]
      frame.pc += 1
      const output = this.execute(op, operands, frame)
      if (output) {return output}
    }
    return { type: 'done' }
  }

  private execute(op: number, operands: number[], frame: Frame): Output | undefined {
    if (op === Opcode.Line) {
      const [speaker, expression, text] = operands.map((index) => this.strings[index])
      return { type: 'line', speaker, expression, text }
    }

    return op === Opcode.Play ? this.play(this.blocks[operands[0]]) : this.returnFrom(frame)
  }

  // Freezes when the first cutscene frame enters the stack.
  private play(block: Block): Output | undefined {
    this.stack.push({ block, pc: 0 })
    if (block.kind !== 'cutscene') {return undefined}
    this.cutsceneFrames += 1
    return this.cutsceneFrames === 1 ? { type: 'freeze' } : undefined
  }

  // Unfreezes when the last cutscene frame leaves it.
  private returnFrom(frame: Frame): Output | undefined {
    this.stack.pop()
    if (frame.block.kind !== 'cutscene') {return undefined}
    this.cutsceneFrames -= 1
    return this.cutsceneFrames === 0 ? { type: 'unfreeze' } : undefined
  }
}
