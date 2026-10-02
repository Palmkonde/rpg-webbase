import { Opcode } from './opcodes.ts'

export type Trigger = 'interact' | 'enter'

export type Flags = Readonly<Record<string, boolean | number | string>>

export interface ShownChoice {
  text: string
  locked?: string
}

export type Output =
  | { type: 'line'; speaker: string; expression: string; text: string }
  | { type: 'choices'; choices: ShownChoice[] }
  | { type: 'flag'; name: string; value: boolean }
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

export interface FlagDeclaration {
  name: string
  default: boolean
}

export interface ProgramData {
  strings: readonly string[]
  flags: readonly FlagDeclaration[]
  blocks: readonly Block[]
}

interface Frame {
  block: Block
  pc: number
}

type Execute = (operands: readonly number[], frame: Frame) => Output | undefined

interface OfferedChoice extends ShownChoice {
  target: number
}

function jump(frame: Frame, target: number): undefined {
  frame.pc = target
  return undefined
}

// Gives `undefined` for a wrong-typed Flag, after naming it; `bool` is the only Flag type.
function readSnapshot(declarations: readonly FlagDeclaration[], snapshot: Flags): boolean[] | undefined {
  const values: boolean[] = []
  for (const { name, default: fallback } of declarations) {
    const value = Object.hasOwn(snapshot, name) ? snapshot[name] : fallback
    if (typeof value !== 'boolean') {
      console.error(`Flag "${name}" is stored as ${JSON.stringify(value)}, but it is declared bool: the run is aborted`)
      return undefined
    }
    values.push(value)
  }
  return values
}

// One run of a handler (adr/0030): each next() or choose(i) executes until the next output and hands it back, never awaiting anything.
export class Run {
  private readonly program: ProgramData
  private readonly stack: Frame[]

  // The snapshot taken at start, plus this run's own writes, by Flag table index.
  private readonly flagValues: boolean[]

  // Where expressions are evaluated.
  private readonly valueStack: boolean[] = []

  private offered: OfferedChoice[] = []

  // Set while a `choices` output waits for choose(i).
  private shown: OfferedChoice[] | undefined

  // The Player is frozen exactly while this is above zero.
  private cutsceneFrames = 0

  public constructor(program: ProgramData, handler: Block, snapshot: Flags) {
    this.program = program
    const values = readSnapshot(program.flags, snapshot)
    this.flagValues = values ?? []

    // A wrong-typed Flag aborts before any output: the run hands back `done` straight away.
    this.stack = values ? [{ block: handler, pc: 0 }] : []
  }

  public next(): Output {
    if (this.shown) {
      throw new Error('The run is waiting for choose(i), not next()')
    }
    return this.resume()
  }

  // `index` is into the choices shown, which leave out the hidden ones.
  public choose(index: number): Output {
    const choice = this.shown?.[index]
    if (!choice || choice.locked !== undefined) {
      throw new Error(`choose(${index}) is not a shown, unlocked choice`)
    }
    this.stack.at(-1)!.pc = choice.target
    this.shown = undefined
    return this.resume()
  }

  // Flags already handed back stay written: saving them was the Host's job.
  public abort(): void {
    this.stack.length = 0
    this.shown = undefined
  }

  private resume(): Output {
    for (let frame = this.stack.at(-1); frame; frame = this.stack.at(-1)) {
      const { op, operands } = frame.block.code[frame.pc]
      frame.pc += 1
      const output = this.instructions[op](operands, frame)
      if (output) {return output}
    }
    return { type: 'done' }
  }

  private readonly instructions: Readonly<Record<number, Execute>> = {
    [Opcode.Return]: (_, frame) => this.returnFrom(frame),
    [Opcode.Line]: (operands) => {
      const [speaker, expression, text] = operands.map((index) => this.program.strings[index])
      return { type: 'line', speaker, expression, text }
    },
    [Opcode.Play]: ([block]) => this.play(this.program.blocks[block]),
    [Opcode.PushBool]: ([value]) => this.push(value === 1),
    [Opcode.PushFlag]: ([flag]) => this.push(this.flagValues[flag]),
    [Opcode.Set]: ([flag]) => this.set(flag),
    [Opcode.Not]: () => this.push(!this.pop()),
    [Opcode.Or]: () => this.binary((left, right) => left || right),
    [Opcode.And]: () => this.binary((left, right) => left && right),
    [Opcode.Equal]: () => this.binary((left, right) => left === right),
    [Opcode.NotEqual]: () => this.binary((left, right) => left !== right),
    [Opcode.Jump]: ([target], frame) => jump(frame, target),
    [Opcode.JumpIfFalse]: ([target], frame) => (this.pop() ? undefined : jump(frame, target)),
    [Opcode.Choice]: ([text, target]) => this.offer(text, undefined, target),
    [Opcode.LockedChoice]: ([text, reason, target]) => this.offer(text, reason, target),
    [Opcode.Choose]: ([below], frame) => this.offerChoices(frame, below),
  }

  private push(value: boolean): undefined {
    this.valueStack.push(value)
    return undefined
  }

  private pop(): boolean {
    return this.valueStack.pop()!
  }

  private binary(operator: (left: boolean, right: boolean) => boolean): undefined {
    const right = this.pop()
    return this.push(operator(this.pop(), right))
  }

  private set(index: number): Output {
    const value = this.pop()
    this.flagValues[index] = value
    return { type: 'flag', name: this.program.flags[index].name, value }
  }

  // A false condition hides the choice, unless it has a locked reason to show instead.
  private offer(text: number, reason: number | undefined, target: number): undefined {
    const holds = this.pop()
    if (holds) {
      this.offered.push({ text: this.program.strings[text], target })
    } else if (reason !== undefined) {
      this.offered.push({ text: this.program.strings[text], locked: this.program.strings[reason], target })
    }
    return undefined
  }

  // With every choice hidden there's nothing to wait for, so the run carries on below the choose.
  private offerChoices(frame: Frame, below: number): Output | undefined {
    const { offered } = this
    this.offered = []
    if (offered.length === 0) {return jump(frame, below)}

    this.shown = offered
    return { type: 'choices', choices: offered.map(({ text, locked }) => (locked === undefined ? { text } : { text, locked })) }
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
