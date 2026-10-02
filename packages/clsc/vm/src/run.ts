import { Opcode } from './opcodes.ts'

export type Trigger = 'interact' | 'enter'

export type Flags = Readonly<Record<string, boolean | number | string>>

export interface Tile {
  x: number
  y: number
}

// A Mover is passed by name: a Character Entity id, or `Player`.
export type CommandArg = string | Tile

// A `Character?` holds a Character, or `false` for `none`: the Host's own value for a dismissed Companion (adr/0028).
type FlagValue = boolean | string
type Value = FlagValue | Tile

export interface ShownChoice {
  text: string
  locked?: string
}

export type Output =
  | { type: 'line'; speaker: string; expression: string; text: string }
  | { type: 'choices'; choices: ShownChoice[] }
  | { type: 'command'; name: string; args: CommandArg[]; waits: boolean }
  | { type: 'flag'; name: string; value: boolean | string }
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
  type: 'bool' | 'Character?'
  default: FlagValue
}

export interface CommandDeclaration {
  name: string
  arity: number
  waits: boolean
}

export interface ProgramData {
  strings: readonly string[]
  flags: readonly FlagDeclaration[]
  commands: readonly CommandDeclaration[]
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

function readStoredFlag(type: FlagDeclaration['type'], stored: Flags[string]): FlagValue | undefined {
  if (type === 'bool') {return typeof stored === 'boolean' ? stored : undefined}
  return stored === false || typeof stored === 'string' ? stored : undefined
}

// Gives `undefined` for a wrong-typed Flag, after naming it.
function readSnapshot(declarations: readonly FlagDeclaration[], snapshot: Flags): FlagValue[] | undefined {
  const values: FlagValue[] = []
  for (const { name, type, default: fallback } of declarations) {
    const value = Object.hasOwn(snapshot, name) ? readStoredFlag(type, snapshot[name]) : fallback
    if (value === undefined) {
      console.error(`Flag "${name}" is stored as ${JSON.stringify(snapshot[name])}, but it is declared ${type}: the run is aborted`)
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
  private readonly flagValues: FlagValue[]

  // Where expressions are evaluated.
  private readonly valueStack: Value[] = []

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
    [Opcode.Not]: () => this.push(!this.popBool()),
    [Opcode.Or]: () => this.logic((left, right) => left || right),
    [Opcode.And]: () => this.logic((left, right) => left && right),
    [Opcode.Equal]: () => this.compare((left, right) => left === right),
    [Opcode.NotEqual]: () => this.compare((left, right) => left !== right),
    [Opcode.Jump]: ([target], frame) => jump(frame, target),
    [Opcode.JumpIfFalse]: ([target], frame) => (this.popBool() ? undefined : jump(frame, target)),
    [Opcode.Choice]: ([text, target]) => this.offer(text, undefined, target),
    [Opcode.LockedChoice]: ([text, reason, target]) => this.offer(text, reason, target),
    [Opcode.Choose]: ([below], frame) => this.offerChoices(frame, below),
    [Opcode.PushName]: ([name]) => this.push(this.program.strings[name]),
    [Opcode.PushNone]: () => this.push(false),
    [Opcode.PushTile]: ([x, y]) => this.push({ x, y }),
    [Opcode.Command]: ([command]) => this.command(command),
  }

  private push(value: Value): undefined {
    this.valueStack.push(value)
    return undefined
  }

  private pop(): Value {
    return this.valueStack.pop()!
  }

  // The compiler type-checks every operand, so a bool operation only ever pops a bool.
  private popBool(): boolean {
    return this.pop() === true
  }

  private logic(operator: (left: boolean, right: boolean) => boolean): undefined {
    const right = this.popBool()
    return this.push(operator(this.popBool(), right))
  }

  // Both operands share a type, so `===` compares bools, Characters and `none` alike.
  private compare(operator: (left: Value, right: Value) => boolean): undefined {
    const right = this.pop()
    return this.push(operator(this.pop(), right))
  }

  // The compiler type-checks the value against the Flag, so it is never a Tile.
  private set(index: number): Output {
    const value = this.pop() as FlagValue
    this.flagValues[index] = value
    return { type: 'flag', name: this.program.flags[index].name, value }
  }

  // The arguments were pushed first to last, each a Mover name or a Tile as the compiler checked.
  private command(index: number): Output {
    const { name, arity, waits } = this.program.commands[index]
    const args = this.valueStack.splice(this.valueStack.length - arity) as CommandArg[]
    return { type: 'command', name, args, waits }
  }

  // A false condition hides the choice, unless it has a locked reason to show instead.
  private offer(text: number, reason: number | undefined, target: number): undefined {
    const holds = this.popBool()
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
