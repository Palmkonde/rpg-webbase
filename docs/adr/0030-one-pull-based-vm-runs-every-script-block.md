---
status: accepted (supersedes adr/0017; amends adr/0018, adr/0025, adr/0028)
---

# One pull-based VM runs every Script block, handing control back to the Host at each wait

CodeLeagues Script (`adr/0029`) lets one block mix lines, nested `choose`s, `set`s, `play`ed Cutscenes and CGs, `section`/`goto` and `loop`/`break`, all read top to bottom. Today's two runtimes can't express that: Dialogue is a whole `Dialogue` object branching through `Choice.next` closures, and Cutscene is a flat `CutsceneStep[]` driven by its own step-runner (`adr/0017`). Compiling down to those shapes would need compiler-generated continuation closures for every line after a `choose`, which is the inside-out structure `adr/0029` exists to remove. So one runner executes every block (`on` handlers, `cutscene`, `cg`, and nested `play`). Each block compiles to a flat instruction list, and a VM runs it with a program counter and a call stack of (block, pc) frames. At every point where it waits (a line, a set of choices, a waiting prelude command, a CG, a Flag write) it returns a value saying what it's waiting for. The Host acts on it and calls back in (`next()` / `choose(i)`), or calls `abort()`.

The VM never awaits anything itself. This keeps the runtime portable to whichever implementation language is chosen, including WASM, which can't await a JS promise mid-function. It also makes a script testable by feeding it inputs and asserting its outputs.

The freeze is a property of the call stack, not of a Script's output: the Player is frozen exactly while a `cutscene` or `cg` frame is on it. The VM emits `freeze` / `unfreeze` when the stack crosses that line. This amends `adr/0018`, where a Cutscene or CG output froze the Player "for its duration": a handler that `play`s a Cutscene unfreezes when it returns, then carries on as ordinary Dialogue. It also amends `adr/0025`. A follow lasts until unfreeze, when the *outermost* Cutscene returns, not when the block that started it returns. Because `follow` is an opaque prelude command to the VM, the Host tracks the followers its `follow` handler started and stops them at unfreeze. It amends `adr/0028` too: the Host re-applies Companions at every unfreeze, after stopping followers, and after a saved Companion Flag write made while not frozen, instead of "after any Script finishes".

Other rules fall out of the same model:
- Only one run exists at a time. Another Interaction, entering a Zone, a Map transition, or dismiss aborts a waiting Dialogue run.
- Flags already written stay written. A block that didn't finish doesn't set its once-only Flag. A Zone counts as seen when its run starts.
- A run reads a Flag snapshot taken at start, plus its own writes. Each write is saved by the Host before the run continues, and a failed save aborts the run, as does a failed waiting command.
- A run never survives a reload or remount.

## Considered Options

- **An `async` tree walk** that awaits Host promises inside the interpreter, the way `play-cutscene.ts` gates work today. It's simpler to write, but it ties the runtime to JS `async/await` and borrows the hard part of pausing from the host language.
- **A tree walk with an explicit cursor stack** (Ink's approach). It's pull-based too, but `goto`, `break` and resuming mid-`choose` mean rebuilding the cursor stack by hand, and that's exactly where this language has features. A flat instruction list turns them all into jumps.
- **Push callbacks** (Yarn's `LineHandler` / `CommandHandler`). We rejected them in favour of pull, where the Host asks for the next output, matching `adr/0017`'s pure-reducer style.
