---
status: accepted (amends adr/0030: the Player is also frozen while a waiting Platform command is pending; amends adr/0039: `mount()` takes Platform command handlers; reopens "commands that return values", which `docs/spec/clsc.md` left out of v1)
---

# Platforms run their own features from Scripts through Platform commands

A Platform that mounts the game wants a Script to start one of its own features over the game, such as a Battle (a coding challenge it grades) or a Lesson (one of its learning pages), and to branch on the outcome. The feature stays the Platform's (`adr/0001`): the game knows only a command's name, arguments, whether it waits and its result. The bundled prelude declares these as `platform command`s, next to the Host's `move` and `follow`:

```
platform command battle(id: String) -> bool in handler, cutscene waits;
platform command lesson(id: String) in handler, cutscene waits;
```

The `platform` marker is what sets them apart from Host commands, so the rules below follow from the prelude and not from a list of names in the Host. Only a `platform command` may declare a result after `->`. `String` is a parameter type that takes a quoted literal at the call site and exists nowhere else in the language. A World can't declare commands (`crpg` still rejects a World's own `prelude.clsc`), and a Platform can't replace `move` or `follow`.

The Platform passes its handlers to `mount()` (and `mountHeadless`) as one optional, typed `platformCommands` record, each handler taking the prelude's parameters by name and an `AbortSignal` last:

```ts
mount(el, { worldId, getToken, platformCommands: {
  battle: (id, signal) => openBattle(id, signal),   // Promise<boolean>
  lesson: (id, signal) => openLesson(id, signal),   // Promise<void>, resolves on close
} })
```

Every handler is optional, unlike a Host command's, so a Platform without Battles mounts cleanly. A Script that calls a Platform command with no handler fails its run and reports a `GameError` through `onError`. A handler that rejects, or resolves `undefined` where a result is declared, fails the run the same way, as a failed Host command already does. Giving up a Battle is a result (`false`), not a failure. Results are not otherwise checked at runtime; the typed record is the guard. When a run is aborted, `unmount()` included, the Host aborts the signal so the Platform can close its feature, and ignores whatever the handler resolves afterwards.

While a waiting Platform command is pending, the Player is frozen, even outside a Cutscene. This extends `adr/0030`, where the Player is frozen exactly while a `cutscene` or `cg` frame is on the call stack: a Lesson opened from `on interact` would otherwise let the Player walk behind the Platform's page into a Portal or a Zone and end the run.

A result reaches the Script through `let` or `set`, and nowhere else:

```
let won = battle("slime_01");          // a local: this run only, never saved
set beat_slime = battle("slime_01");   // a Flag: saved at once
set beat_slime = won;                  // a Flag from a local
```

A local is read-only once bound and visible from its `let` to the end of the enclosing body or the next `section` label, whichever comes first. Since `goto` lands only on a section label, it can never reach a use of a local whose `let` it skipped, with no flow analysis. A local can't share a name with a Flag, a cast name or another local in scope, and a `play`ed Cutscene can't see the locals of the block that played it. `let` takes any expression, but a call to a command with a result may appear only as the whole value of a `let` or a `set`, never inside an `if`, a choice's condition or a larger expression, so it runs once, at a statement the Author can see. A Battle's result is `bool` (true = won); enum results wait until a third outcome exists, and `let` is already the piece that will carry them.

## Considered Options

- **The World declares its Platform commands in its own Script files.** Rejected: the maintainer chose one engine-wide set, so every World and Platform shares the same Battle and Lesson.
- **The Platform declares its commands at `mount()`.** Rejected: the compiler can't see them at build time, so calls can't be type-checked.
- **Built-in `battle`/`lesson` language constructs.** Rejected: one general mechanism covers both, and the next Platform feature needs only a prelude line.
- **The Platform pushes the outcome as a Flag write the run can see.** Rejected: it breaks the run's Flag snapshot (`adr/0030`) and gives the Platform write access to the Student's Flags.
- **The call names a Flag the Host fills from the result (`battle("slime_01") -> beat_slime;`).** Rejected: a Flag write without `set` is the kind of hidden write the language removed, transient outcomes would each need a saved Flag, and giving up after an earlier win would overwrite the win.
- **Required Platform handlers, failing startup when one is missing, like Host commands.** Rejected: every Platform would have to stub features it doesn't have.
- **Allow Platform commands only `in cutscene`, instead of freezing.** Rejected: every Battle and Lesson would need a Cutscene wrapped around it.
