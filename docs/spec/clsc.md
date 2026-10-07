# CodeLeagues Script — Confirmed Spec

Confirmed 2026-10-01 from the wayfinder map "Script language: from TypeScript Scripts to our own interpreted language" (issue #39) and the grilling session that closed it. Kept apart from `spec.md`, which covers the Engine and the Host's TS Scripts; this file covers the language that replaces those Scripts. The decisions behind it are `adr/0029`–`adr/0032`; vocabulary is in `../../GLOSSARY.md`.

## Problem Statement

Scripts are TypeScript today: a `ScriptBuilder` chain for Dialogue, a `CutsceneStep[]` registry for Cutscenes, and `Choice.next` closures that turn branching dialogue inside out. A designer can't write one without knowing TS, can't read one top to bottom, and can't mix lines, choices, Flag writes, Cutscenes and CGs in one block. The two runtimes (the Dialogue overlay and the Cutscene step-runner) each handle half the job, and the hidden `<id>_seen` gates decide once-only behaviour where the author can't see them.

## Solution

Scripts are written in CodeLeagues Script (`.clsc`), a statically typed language with C-style braces and quoted lines. A Rust compiler checks the whole scripts root at build time and emits one bytecode file. A TypeScript VM in the browser runs every Script block with a pull-based interface the Host drives. The existing Scripts (CampFireVis, Guard, CampFire and the Cutscenes they play) are ported one at a time, each playtested against its TS original, and the TS Script path is then deleted. Designers get a complete language reference in `docs/guides/`.

## User Stories

### Writing a Script

1. As a designer, I want to write a Script as a `.clsc` file that reads top to bottom, so that I can follow a conversation without tracing closures.
2. As a designer, I want to write a line as `Speaker(Expression): "text";`, so that who says what, and how, sits on the line itself.
3. As a designer, I want a line without an Expression to show the Speaker's Neutral Portrait, so that I only write an Expression when it matters.
4. As a designer, I want to write a line as `Speaker: @key;` to pull its text from the String Table, so that a line can be translated later without rewriting the Script.
5. As a designer, I want inline English text to be the default, so that drafting a Script doesn't need a String Table entry for every line.
6. As a designer, I want to use `@key` in choice labels and `locked(...)` reasons too, so that every player-visible string follows the same rule.
7. As a designer, I want to write Thai directly inside quotes, so that I don't need escapes for non-ASCII text.
8. As a designer, I want `//` line comments, so that I can leave notes in a Script.
9. As a designer, I want to bind a Script to a Character Entity with `on interact(Id) { … }`, so that talking to it runs my block.
10. As a designer, I want to bind a Script to a Zone with `on enter(Id) { … }`, so that walking into it runs my block.
11. As a designer, I want to put `on` handlers in any file under the scripts root, so that I can organise files by story, not by Entity.
12. As a designer, I want two handlers for the same trigger and id to be a compile error, so that one never silently shadows the other.
13. As a designer, I want to declare a Flag as `flag name: type = default;`, so that every piece of Student state a Script reads is named and typed.
14. As a designer, I want to read a Flag by its bare name and write it with `set name = value;`, so that Flag logic reads like plain conditions.
15. As a designer, I want `bool` and `Character?` Flags with `!`, `&&`, `||`, `==`, `!=` and parentheses, so that I can express every gate today's Scripts need.
16. As a designer, I want `if` / `else if` / `else`, so that a block can branch on Flags.
17. As a designer, I want a `choose` block, so that I can offer the Player choices inline, nested as deep as I need.
18. As a designer, I want `"text" if cond => { … }` to hide a choice when the condition is false, so that the Player never sees an option that makes no sense yet.
19. As a designer, I want `if cond else locked("reason")` to show a choice greyed out with a reason, so that the Player can see what they're missing.
20. As a designer, I want a bare `"Never mind";` choice that does nothing, so that a no-op option is one line.
21. As a designer, I want execution to continue below the `choose` after a choice's body, so that branches reconverge without extra structure.
22. As a designer, I want `section` and `goto` within one block, so that I can jump back to an earlier point in a conversation.
23. As a designer, I want `loop` and `break`, so that I can repeat a menu until the Player leaves.
24. As a designer, I want `return`, running off the end and finishing a `section` all to end the current block, so that the rules for where a block stops are the same everywhere.
25. As a designer, I want to declare a `cutscene` block and run it with `play(cutscene::id)`, so that a scene can be reused from more than one handler.
26. As a designer, I want to declare CG ids in `.clsc` and trigger one with `play(cg::id)`, so that a Script can show a CG and then carry on.
27. As a designer, I want a `play`ed block to return to the line below the call, so that a handler can play a Cutscene and keep talking.
28. As a designer, I want to mark a `cutscene` or `cg` once-only with `} set seen_x = true;`, so that once-only behaviour is visible in the Script instead of hidden in the runtime.
29. As a designer, I want unmarked blocks to run every time, so that helper Cutscenes aren't silently gated.
30. As a designer, I want `move(who, (x, y))` and `follow(follower, leader)` inside a `cutscene`, so that I can stage Movement and Follow steps.
31. As a designer, I want `move` or `follow` inside a handler body to be a compile error, so that Movement only happens while the Player is frozen.
32. As a designer, I want to declare each Speaker, Mover and Character once in `cast.clsc`, so that every name is spelled one way.
33. As a designer, I want every `cutscene` and `on` handler to list its cast with `with …`, so that I can see who appears in a block before reading it.
34. As a designer, I want a name used but not listed in `with` to be an error, and a name listed but unused to be a warning, so that the cast list stays honest.
35. As a designer, I want to read and write `companion[CharacterEntity]` without declaring it, so that recruiting a Companion is one `set`.
36. As a designer, I want `use a.b;` to load another file from the scripts root, so that I can split long stories across files.
37. As a designer, I want a `_name` to be private to its file, so that helpers don't leak into other files.
38. As a designer, I want a complete reference in `docs/guides/` covering every v1 language feature with an example, so that I can write a Script without editor support or asking a developer.

### Compiling

39. As a designer, I want every compile error to print as `path:line:col`, the source line, a caret and a message, so that I can find the problem without reading compiler internals.
40. As a designer, I want a type error, an unknown name, a missing `@key` or a duplicate handler to fail the compile, so that mistakes surface before I play.
41. As a designer, I want a `@key` missing from any Locale in the String Table to be a compile error, so that no keyed line ships untranslated by accident.
42. As a designer, I want a Flag stored in the seed with the wrong type for its declaration to be a compile error, so that bad seed data is caught at build time.
43. As a designer, I want `bun run dev` to recompile on save and print errors in the terminal labelled `[clsc]`, so that I see mistakes as I write.
44. As a designer, I want the last good bytecode to stay in place when a dev compile fails, so that the game keeps running while I fix the error.
45. As a designer, I want a recompile to be picked up on page reload, so that I don't restart the dev server.
46. As a developer, I want `next build` to compile every Script first and fail on a compile error, so that a broken Script never ships.
47. As a developer, I want `clsc disasm` to print the bytecode as text, so that I can debug what the compiler emitted.
48. As a developer, I want everyone who runs the app to work in the Nix dev shell, which pins the Rust toolchain and builds the compiler from source, so that every machine compiles Scripts the same way.

### Running

49. As a Player, I want talking to a Character Entity to run its Script, so that conversations work as before.
50. As a Player, I want walking into a Zone to run its Script once, so that Zone stories still play only the first time.
51. As a Player, I want to be frozen exactly while a Cutscene or CG is playing, so that I can't walk away mid-scene but can move during ordinary Dialogue.
52. As a Player, I want followers to stop when control returns to me, so that a Follow step started in a nested Cutscene doesn't outlive the outermost one.
53. As a Player, I want my Companions re-applied whenever control returns to me, so that a recruited Companion follows me straight away.
54. As a Player, I want starting another Interaction, entering a Zone, changing Map or dismissing to end the Dialogue that's waiting, so that only one conversation is ever open.
55. As a Player, I want Flags already written to stay written when a run is cut short, so that progress isn't lost.
56. As a Player, I want a once-only Cutscene that didn't finish to play again next time, so that I don't miss it.
57. As a Host developer, I want the VM to hand back one output at a time (`line`, `choices`, `command`, `cg`, `flag`, `freeze`, `unfreeze`, `done`) and wait for `next()`, `choose(i)` or `abort()`, so that the Host decides how and when to show each one.
58. As a Host developer, I want `line` and `choices` to carry either literal text or a key, so that the Host resolves keys against the current Locale and the VM knows nothing about locale.
59. As a Host developer, I want each `flag` output saved before the run continues, and a failed save to abort the run, so that a run never gets ahead of what's stored.
60. As a Host developer, I want a waiting `command` to be awaited by its Host handler, and a failed one to abort the run, so that Movement finishes before the next line.
61. As a Host developer, I want the Host to supply one handler per `command` declared in `prelude.clsc`, and startup to fail if one is missing, so that a Script can't call a command nobody handles.
62. As a Host developer, I want a new statement-shaped Engine feature to need one prelude line plus one Host handler and no compiler change, so that the language grows with the Engine cheaply.
63. As a Host developer, I want the Host to fetch the bytecode once at startup and fail with a clear message if it's missing or the version doesn't match, so that a world never runs with no Scripts.
64. As a Host developer, I want a run to read a Flag snapshot taken at start plus its own writes, so that a mid-run outside write (like the Companion dismiss button) can't change a run in flight.
65. As a Host developer, I want a declared Flag missing from the store to read as its default, so that a Flag nobody has written yet just works.
66. As a Host developer, I want a stored Flag with the wrong type to abort the run with a `console.error` naming the Flag, so that the VM never acts on corrupt data.
67. As a Host developer, I want one overlay to serve every VM run, with dismiss shown only while not frozen, so that Dialogue and Cutscene lines look and behave the same.
68. As a Host developer, I want the Host to do the unfreeze work itself if a run aborts while frozen, so that an aborted Cutscene never leaves the Player stuck.

### Porting

69. As a developer, I want the Host to run a `.clsc` handler when the bytecode index has one for (trigger, id) and fall back to the TS Script otherwise, so that Scripts can be ported one at a time.
70. As a developer, I want CampFireVis ported first, as a tracer bullet through the whole pipeline, so that the toolchain, compiler, bytecode file, fetch, index, `enter` trigger, freeze and merged overlay are all proven on the smallest Script.
71. As a developer, I want Guard ported second, so that cast, `interact`, `move`/`follow` commands, `choose` and `companion[…]` are proven next.
72. As a developer, I want CampFire ported last, so that Flags, hidden and locked choices, nested `choose`, `cg`, a Cutscene that branches mid-scene and `@key` lines are proven on top of a working pipeline.
73. As a developer, I want each port manually playtested against its TS original before its TS Script is deleted, so that parity is judged by playing it.
74. As a developer, I want the TS Script path deleted once CampFire passes its playtest, so that there's one way to write a Script.

### Maintaining the language

75. As a language developer, I want the opcode table to live in Rust and `build.rs` to generate the TS opcode constants, so that the two sides can't disagree about opcodes.
76. As a language developer, I want every bytecode file to start with a magic number and a format version, and the VM to refuse a version it doesn't expect with an error naming both, so that a mismatch fails loudly.
77. As a language developer, I want to choose the bytecode's byte layout while building the compiler, so that I learn by designing it instead of following a guess written up front.
78. As a language developer, I want `bun run test` to run the compiler tests, compile the fixtures and run the VM tests, so that one command checks both halves.
79. As a language developer, I want `bun run lint` to run `cargo clippy -- -D warnings`, so that the Rust half has the same gate as the TS half before `/code-review`.
80. As a language developer, I want rust-analyzer in the dev shell, checking with clippy, so that I see warnings while I type.

## Implementation Decisions

### Package

- A new package `clsc` holds both halves: a Rust crate (binary `clsc`) for the compiler and a Bun workspace package (`@codeleagues-rpg-engine/clsc`) for the VM. It is separate from `engine-core`: the Engine knows nothing about Scripts (`adr/0001`), and an `engine-` prefix on a Host-side package would contradict the glossary.
- The compiler uses pest, with the grammar in its own file. It runs only at build time, never in the browser.
- The Nix dev shell gains the pinned Rust toolchain and rust-analyzer. There is no prebuilt binary (`adr/0031`).

### Compiler

- **CLI.** `clsc build` compiles the scripts root as one program into one bytecode file, taking `--strings <String Table path>` and `--store <Flag seed path>`. `clsc build --watch` recompiles on save (the `notify` crate). `clsc disasm` prints a bytecode file as text.
- **Compile unit.** Every `.clsc` file under the scripts root, with the reserved `cast.clsc` and `prelude.clsc` included without a `use` (`adr/0032`). The language package ships no prelude: the prelude is part of the Host's contract.
- **Checks.** Name resolution and static types for Flags, cast names, enums (including Expression), String Table keys, and Cutscene and CG ids. Block-kind rules (no `move`/`follow` outside a `cutscene`). `goto` names a section in its own block, section names are unique within a block, and `break` sits inside a `loop`. `with` cast lists (used but not listed is an error, listed but unused is a warning). `_private` names. Duplicate names across `use`d files. Duplicate (trigger, id) handlers. Missing `@key`s in any Locale. Seed Flags whose type doesn't match their declaration.
- **Errors.** Every error, parse or semantic, renders through pest's own formatting. Semantic errors are built from a span with a custom message. A duplicate handler prints two errors, one at each definition. Warnings print but don't fail the compile.
- **Build integration.** `prebuild` runs `clsc build`, so a compile error fails `next build`. `bun run dev` runs `clsc build --watch` next to `next dev` via `concurrently`, labelled `[clsc]` and `[next]`. A failed dev compile leaves the last good bytecode in place. The output file is generated and gitignored.

### Bytecode contract

The spec fixes what the file contains, not its byte layout. The layout is worked out while building the compiler, and any layout change bumps the format version.

- A magic number and a format version. The VM refuses an unexpected version with an error naming both versions.
- A string pool: line text, keys and names.
- Flag declarations, each with its type and default. This includes the compiler-declared once-only Flags.
- Command declarations from the prelude: name, arguments, which block kinds allow it, and whether it waits.
- A handler index keyed by (trigger, id), with `interact` and `enter` as separate namespaces.
- The blocks, each a flat instruction list (`adr/0030`).
- The opcode table lives in Rust, and `build.rs` generates the TS opcode constants.
- `clsc disasm` prints all of the above.

### VM

- **Load.** It takes the bytecode bytes and the Host's command handlers. It fails if the header is wrong or a declared command has no handler.
- **Interface** (`adr/0030`):
  - In: `start(trigger, id, flags)` returns a run, or nothing if no handler matches. Then `next()`, `choose(i)` and `abort()`.
  - Out, one at a time:

| out | Host does | then |
|---|---|---|
| `line { speaker, expression, text \| key }` | resolve a key, show it | `next()` on click |
| `choices [{ text \| key, locked?: { text \| key } }]`, hidden ones removed | show them | `choose(i)`, an index into what was shown |
| `command { name, args, waits }` | run the handler, awaiting it if `waits` | `next()`, or `abort()` on failure |
| `cg { id }` | play the CG | `next()` when it ends or is skipped |
| `flag { name, value }` | save it; re-sync Companions if it's a Companion Flag and not frozen | `next()`, or `abort()` on failure |
| `freeze` / `unfreeze` | pause or unpause; on unfreeze, stop the followers the `follow` handler started, then re-sync Companions | `next()` |
| `done` | clear the overlay | — |

- **Freeze.** The VM emits `freeze` / `unfreeze` when a `cutscene` or `cg` frame enters or leaves an otherwise unfrozen call stack.
- **Flags.** `start()` checks the snapshot against the declarations:
  - A declared Flag missing from the snapshot reads as its default.
  - A declared Flag with the wrong type aborts the run before any output, with a `console.error` naming it.
  - An undeclared stored Flag is invisible.
  - `companion[X]` maps the Host's Companion Flag to `Character?`, with the Host's `false` read as `none`.
- **Once-only blocks.** `play` skips a once-only block whose Flag is already true. The once-only Flag is written (as a `flag` output) only when the block finishes.
- **No awaiting.** The VM never awaits anything. It holds no state between runs, and a run never survives a reload or remount.

### Host

- **Startup.** The Host fetches the bytecode once, the same way it fetches Maps, then loads it into the VM with its command handlers. A missing file, a version mismatch or a missing handler fails startup with a message that says which.
- **Dispatch.** The Script player, the Host's single entry for Interactions and Zone entries, runs its existing gates first (no talking to Companions, the Zone-seen Flag). It then calls `start` for (trigger, id). If a run comes back, the VM drives it. Otherwise nothing happens. Only one run exists at a time.
- **Commands.** The prelude declares `move` (waits) and `follow` (doesn't wait). Their Host handlers call the Engine's existing Movement and Follow APIs. The Host tracks the followers that `follow` started and stops them at `unfreeze`. The Follow gap is always 0 in v1.
- **Overlay.** One overlay serves every VM run. It resolves keys with the existing String Table lookup and the current Locale, shows Portraits from Speaker and Expression, and shows dismiss only while not frozen.
- **CG.** A `cg` output plays through the existing CG playback. Once-only gating moves from `runOnce` to the Script's own marker.

### Porting and deletion

- **Order.** CampFireVis, then Guard, then CampFire, along with the Cutscenes each one plays (`campfire-story-step-into-zone`, `guard-walk`, `campfire-story` and its branches).
- **Parity.** Each port is manually playtested against its TS original before its TS Script is deleted, judged against the full TS Cutscenes, not the shortened prototype files.
- **Deletion.** Once CampFire passes, the TS path goes: the TS Scripts and their lookup, `ScriptBuilder`, the Cutscene builder and registry, `Dialogue` / `CutsceneStep[]` / `Choice.next`, the Cutscene step-runner, `runOnce` for Cutscene and CG, the TS-era overlays, and their tests. The Zone-seen gate stays: it is the Host's.

### Docs

- A designer-facing language reference in `docs/guides/` covers every v1 feature with an example, including features no port uses. It must be complete before the TS path is deleted.

### Lint

- `bun run lint` also runs `cargo clippy -- -D warnings` on the compiler crate. rust-analyzer in the dev shell checks with clippy. `CODING_STANDARDS.md` applies to Rust as written. A Rust section is added only once a Rust-specific rule actually comes up.

## Testing Decisions

- **What a good test is.** It asserts what a Script *does*, meaning the ordered outputs a run hands back or the errors a compile prints, never the compiler's internal structures or the VM's stack. One behaviour per test, named as a sentence (`CODING_STANDARDS.md`).
- **Seams.** There are two, both in the `clsc` package:
  1. **The VM's pull interface** (load, `start` / `next` / `choose` / `abort` → outputs). This is the main seam. A small `play(program, { on, flags, picks })` helper answers each `choices` with the next pick, calls `next()` on everything else, and stops at `done`. A test asserts the **full ordered output sequence**, including `freeze` / `unfreeze` / `flag` / `command`, with `deepEqual`. A `@key` line is asserted as its key.
  2. **The compiler's diagnostics.** Expected-error fixtures carry `// error: <message>` on the offending line. `cargo test` compiles each one and asserts the exact line, the exact message, and that no other errors appear. A whole-program error, such as a duplicate handler across files, gets a fixture directory.
- **Layers**, each built along with the stage it covers, in pipeline order:
  1. Rust unit tests per stage (parser, checker, codegen).
  2. Expected-error fixtures.
  3. VM unit tests for the fiddly parts: header and version check, missing command handlers, Flag snapshot defaults and wrong types, `abort()`, a failed save or command aborting a run. They use compiled tiny sources, never hand-written bytecode.
  4. End-to-end language fixtures: one tiny `.clsc` per feature, compiled by the real compiler and run by the real VM through `play()`.
- **Running.** The package's `test` script runs `cargo test`, then `clsc build` on the fixture sources into a gitignored directory, then `bun test` (`adr/0033`). Root `bun run test` picks it up through workspaces. No bytecode is checked in. Rust writes the fixtures and TS decodes them (`adr/0031`).
- **Real Scripts** get no output tests in v1. Their automated check is that the whole program compiles in `prebuild`. A developer adds a `play()` test for a real Script once it gets intricate enough to break unnoticed.
- **Host wiring** (dispatch, overlay, command handlers, follower tracking, Companion re-sync, startup failure messages) is verified by manual playtest, like the overlay and Scene wiring before it. There is no e2e or browser automation (`CLAUDE.md`).
- **Prior art.** `node:test` + `node:assert/strict` with no mocking framework, as in `engine-core`'s `tile-animation.test.ts` and the Host's `cutscene-runner.test.ts` / `flags.test.ts`. Error fixtures follow Crafting Interpreters' annotated-fixture suite.

## Out of Scope

- **Editor support** (syntax highlighting, a language server, live error squiggles). Compiler work comes first.
- **Hot reload** of bytecode without a page reload.
- **Checking `on` ids and cast names against the Tiled Maps**, and doing ADR-0012's cross-Map `entityId` uniqueness check in the compiler.
- **Quest.** It isn't designed as a domain concept yet.
- **Authoring CG slideshow content.** The language only triggers a CG.
- **Resuming a run partway through** after a reload or remount.
- **Player-switchable translation** (English and Thai, including translated Speaker names). That's v2, and `@key` lines are the route to it.
- **Getting the compiler into a deploy build.** No deploy target exists yet.
- **Left out of the v1 language:** numbers and arithmetic, string interpolation, `/* */` comments, a Follow gap other than 0, a default Speaker, parameterised Cutscenes, `play(dialogue::x)`, Map-entry handlers, and commands that return values.
- **Moving the VM to Rust/WASM.** That would be a separate effort.

## Further Notes

- The `script-language` branch holds all of this work. The TS Scripts keep working on it until each one's port passes its playtest.
- The syntax verdict and the three rejected candidates are on branch `prototype/script-language`, under the prototype README. The runtime research on Yarn and Ink, and the parser-language research, are on the `research/*` branches.
- `resolveLine`'s fallback (to English, then `[key]`) becomes unreachable for keyed lines once the compiler rejects missing keys. It is left in place for the CG captions that still use it.
