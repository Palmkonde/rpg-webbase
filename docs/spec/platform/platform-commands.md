# Platform Commands: Battles and Lessons Started From a Script

Confirmed 2026-11-01 via grilling session on #141. Decision record: `adr/0048`, amending `adr/0030` and `adr/0039`, and reopening "commands that return values", which `clsc.md` left out of v1. See `GLOSSARY.md`'s **Platform command**, **Battle** and **Lesson** entries.

## Problem Statement

A learning Platform replacing its old game with this one wants its coding combat back. Touching a monster opened a fight that the Student won by solving a coding problem the Platform graded. It also wants a Script to open one of its own learning pages, for example when the Student interacts with a chalkboard. The Platform owns both features completely: it draws them over the game, grades, applies access rules and pays rewards. What it needs from the game is for a Script to decide *when* one starts and *what follows*: different Dialogue and Flags after a win than after giving up.

Nothing lets a Script do that today. The Host's commands are fixed to `move` and `follow`, and `mount()` takes no Platform handlers. A waiting command can pause a run but can't hand a value back to it. The Platform can't push the outcome in as a Flag either, because a run reads a Flag snapshot taken at its start plus its own writes (`adr/0030`). And combat itself can't move into the Engine (`adr/0001`).

## Solution

The bundled prelude declares two Platform commands, `battle` and `lesson`, beside `move` and `follow`. A Platform passes its handlers for them to `mount()`. A Script calls them from an `on` handler or a Cutscene. While a waiting Platform command is pending, the Player is frozen and the Platform's feature has the screen. When the handler resolves, the run carries on. A Battle hands back whether the Student won. The Script keeps the result for this run with `let won = battle("slime_01");`, or saves it as a Flag with `set beat_slime = battle("slime_01");`, then branches on it as on any other value. A Platform that has no Battles mounts without a `battle` handler. A World that calls one anyway fails that run and reports it through `onError`, and the game carries on.

## User Stories

1. As a Student, I want touching a monster to open the Platform's coding challenge over the game, so that I fight it by solving a problem.
2. As a Student, I want the game to react to whether I won, so that beating a monster feels like it mattered.
3. As a Student, I want to give up a Battle and be back in the game, so that a problem I can't solve yet doesn't trap me.
4. As a Student, I want to be unable to walk while a Battle or Lesson is open, so that my Player doesn't wander into a Portal or a Zone behind the Platform's screen.
5. As a Student, I want control back as soon as the Battle or Lesson closes, so that play resumes where I left it.
6. As a Student, I want interacting with a chalkboard to open a short lesson, so that I learn the idea a later Battle tests.
7. As a Student, I want a monster I already beat to say something different when I talk to it again, so that the World remembers my win.
8. As a Student, I want giving up a Battle I already won earlier to leave the earlier win standing, so that I never lose progress by retrying.
9. As a Student, I want a broken Battle on the Platform's side to end that scene and leave me playing, so that one failure doesn't stop the whole game.
10. As an Author, I want to start a Battle with one statement, so that adding a fight to an Entity is as small as adding a line.
11. As an Author, I want to keep a Battle's result as a local with `let`, so that I can branch on it without saving a Flag for every outcome.
12. As an Author, I want to save a Battle's result straight into a Flag with `set`, so that a win lasts across sessions when I want it to.
13. As an Author, I want to save a local into a Flag later with `set flag = local;`, so that I decide which outcome is worth remembering.
14. As an Author, I want `let` to take any expression, such as `let ready = met_guard && !beat_slime;`, so that I can name a condition I use more than once.
15. As an Author, I want a local to be read-only once bound, so that its value can't change between the line that sets it and the one that reads it.
16. As an Author, I want a local to end at the end of its body or the next `section`, so that a `goto` can never reach a local that was never bound.
17. As an Author, I want a local with the same name as a Flag, a cast name or another local in scope to be a compile error, so that a name always means one thing.
18. As an Author, I want `set` on a local to be a compile error, so that `set` always means a saved Flag.
19. As an Author, I want a call that returns a result to be allowed only as the whole value of a `let` or a `set`, so that a Battle never starts from inside a condition or a choice list.
20. As an Author, I want a bare `battle("x");` that drops its result to be a compile error, so that a Battle's outcome is never ignored by accident.
21. As an Author, I want `set flag = battle(…)` to be a compile error when the Flag isn't a `bool`, so that a result never lands in the wrong kind of Flag.
22. As an Author, I want to start a Battle or Lesson from an `on interact`, an `on enter`, an `on arrive` or a Cutscene, so that any trigger can lead into one.
23. As an Author, I want a Battle or Lesson inside a Cutscene to keep the Cutscene's freeze unbroken, so that the scene carries on straight after it.
24. As an Author, I want to pass a quoted id, such as `battle("slime_01")`, so that I name which challenge the Platform opens.
25. As an Author, I want a command id to be checked as a string literal and nothing more, so that the Platform alone decides what the id means.
26. As an Author, I want declaring a command in my World's files to stay a compile error, so that the set of commands is the same for every World.
27. As an Author, I want the guide to warn that a Battle started from a Zone is lost for good if the page reloads mid-Battle, and to show the `on interact` pattern instead, so that I don't lose a fight I can't replay.
28. As an Author, I want the guide to show a full Battle and a full Lesson, so that I copy a working pattern.
29. As an Author, I want `let`, `platform` and `String` highlighted in VS Code, so that new code reads like the rest.
30. As a Platform developer, I want to pass `battle` and `lesson` handlers to `mount()`, so that my own features open when a Script asks.
31. As a Platform developer, I want each handler typed from the prelude, with its parameters named, so that my compiler catches a wrong signature.
32. As a Platform developer, I want every Platform command handler to be optional, so that I can mount the game without features I don't have.
33. As a Platform developer, I want my `battle` handler to resolve `true` for a win and `false` for giving up, so that giving up is a normal result, not an error.
34. As a Platform developer, I want my `lesson` handler to resolve when the Student closes the page, so that the Script carries on at the right moment.
35. As a Platform developer, I want each handler to get an `AbortSignal` that fires when the run is aborted, `unmount()` included, so that I can close my feature with it.
36. As a Platform developer, I want a result I resolve after the run was aborted to be ignored, so that a late answer can't act on a finished run.
37. As a Platform developer, I want a rejected handler to end the run and reach me through `onError`, so that I hear about my feature failing.
38. As a Platform developer, I want a `battle` handler that resolves `undefined` to be treated as a failure, so that a bug on my side never records a loss.
39. As a Platform developer, I want a World calling a command I gave no handler for to reach me through `onError`, so that I learn the World expects a feature I didn't wire up.
40. As a Platform developer, I want a Platform command failure to leave the game running, without the built-in error screen, so that one broken feature doesn't end the session.
41. As a Platform developer, I want `mountHeadless` to take the same handlers, so that a headless mount can run Battles and Lessons too.
42. As a Platform developer, I want the client guide to show the two handlers, so that I wire them up without reading the source.
43. As a Host developer, I want the VM to emit `freeze` and `unfreeze` around a waiting Platform command, so that the freeze stays a VM rule like a Cutscene's.
44. As a Host developer, I want to resume a Platform command with `next(result)`, so that a result reaches the run through the same pull interface as everything else.
45. As a Host developer, I want the VM to refuse a resume with no value where a result is declared, so that an `undefined` result fails the run with no extra check in the Host.
46. As a Host developer, I want the VM to require handlers only for Host commands, so that a Platform without Battles still loads the program.
47. As a Host developer, I want the `command` output to say whether a command is a Platform command, so that I route it to the Platform's handlers, not the Host's.
48. As a language developer, I want `platform` to be the only thing setting Platform commands apart, so that the rules follow from the prelude, not from a list of names in the Host.
49. As a language developer, I want only a `platform command` to declare a result, so that Host commands stay exactly as they are.
50. As a language developer, I want the bytecode format version raised, so that an old Host refuses a program it can't run.
51. As a future maintainer, I want it recorded why Worlds don't declare commands and why results don't go straight into Flags, so that nobody reopens those options without the reasons.

## Implementation Decisions

- **Prelude.** It gains `platform command battle(id: String) -> bool in handler, cutscene waits;` and `platform command lesson(id: String) in handler, cutscene waits;`. `move` and `follow` stay unchanged. The prelude is still bundled in the compiler, and `crpg` still rejects a World's own `prelude.clsc`.
- **Grammar.** A `command_decl` takes an optional `platform` marker before `command` and an optional `-> <type>` after the parameters. `let <name> = <expr>;` is a new statement. A command call may also be the whole right-hand side of a `let` or a `set`. A quoted string literal is a new argument form. `platform` and `let` become keywords, and the VS Code grammar gains them (the existing sync test enforces this).
- **Compiler checks.**
  - Only a `platform command` may declare `->`, and its result type is a value type (`bool` for now).
  - `String` is a parameter type that only a quoted literal satisfies. There are still no string values, Flags or locals.
  - A call to a command with a result may appear only as the whole value of a `let` or a `set`: not as a bare statement, nor inside any other expression. A `set` from a call must match the Flag's type.
  - A local is visible from its `let` to the end of its enclosing body or the next `section` label, whichever comes first. A name that clashes with a Flag, a cast name or a local in scope is an error. `set` on a local is an error.
  - Block-kind checks use the existing `in` list. A Platform command name that clashes with a Host command is a duplicate-name error, as now.
- **Bytecode contract.**
  - Each command declaration records whether it's a Platform command and its result type.
  - Parameters gain `String`, and string literals go in the existing string pool.
  - New instructions bind and read a local slot per frame.
  - `FORMAT_VERSION` goes up.
- **VM.**
  - The `command` output gains `platform: boolean`.
  - Loading checks that a handler exists only for Host commands.
  - For a waiting Platform command, the VM emits `freeze` first when no `cutscene` or `cg` frame is on the stack, and the matching `unfreeze` on resume (`adr/0030`, as amended by `adr/0048`).
  - `next(value)` resumes a command that declares a result. The VM pushes the value and throws if it's missing or isn't a `bool`. A resume after a command with no result takes no value.
  - Locals live in their frame and go when the frame returns.
- **`mount()` contract** (`adr/0039`, amended). `GameOptions` gains an optional `platformCommands` record, so `mountHeadless` takes it too. Each key is optional and typed from the prelude: `battle(id: string, signal: AbortSignal): Promise<boolean>` and `lesson(id: string, signal: AbortSignal): Promise<void>`. The client keeps this type by hand beside its prelude-declared commands.
- **Host.**
  - On a Platform `command` output, the Host calls the matching `platformCommands` handler with the arguments spread and the run's `AbortSignal` last. It awaits the handler if the command waits, then resumes with `next(result)`.
  - A missing handler, a rejection or an `undefined` result throws into the run's existing failure path. The run aborts and unfreezes, and the Host also reports a `GameError` of a new non-fatal kind, `platformCommand`, through `onError`. The built-in error screen doesn't show it, and the session keeps running.
  - The run's `AbortController` aborts whenever the run ends early: `abort()`, a Transition or `unmount()`. A late result is already ignored, because a run that is no longer in flight stops taking outputs.
  - Host commands' handlers are unchanged.
- **Demo.** The reference Platform (`apps/web`) wires stub handlers: a Battle overlay with Win and Give up buttons, and a Lesson overlay with Close. The `demo` World gains one Entity whose `on interact` runs a Battle and branches on it, and one that opens a Lesson.
- **Docs.**
  - `docs/guides/codeleagues-script.md` gains `let`, Platform commands, the Battle and Lesson patterns, and the Zone warning.
  - `docs/guides/client.md` gains `platformCommands`, the result contract, `AbortSignal` and the `platformCommand` error kind.
  - `docs/mermaid/play-session.md`'s `mount()` call and `script-pipeline.md`'s VM output list are updated to match.

## Testing Decisions

- A good test drives a module through its public seam and asserts what a caller sees, not how it gets there. These are the seams the tests use, all existing ones:
- **Compiler** (prior art: the `errors/command-calls/` fixtures and the error-fixture runner, plus the compile fixtures the VM tests use).
  - Error fixtures:
    - `->` on a Host command.
    - A non-literal argument to a `String` parameter.
    - A result call as a bare statement, or inside an `if`, a choice condition or a larger expression.
    - `set` of a non-`bool` Flag from `battle`.
    - `set` on a local.
    - A local shadowing a Flag, cast name or local.
    - A local read after a `section` label.
    - A command declared outside the prelude.
  - A valid fixture with `let`, `set flag = battle(…)` and a bare `lesson(…)` compiles.
- **VM pull interface** (prior art: `commands.test.ts` and the `play()` helper's ordered `deepEqual` output sequences). `play()` gains a way to answer Platform commands with results. The tests assert:
  - The full output sequence for a Battle in an `on` handler: `freeze`, the `command` with `platform: true`, `unfreeze`, then the branch the result picks.
  - The same Battle inside a Cutscene emits no extra `freeze`/`unfreeze`.
  - A non-waiting Platform command doesn't freeze.
  - A missing or non-`bool` resume value throws.
  - Locals hold their value until the frame returns.
  - Loading succeeds with no Platform handlers.
- **Host session with the fake Engine** (prior art: `session.test.ts` and `session-errors.test.ts`). The tests assert:
  - A `platformCommands` handler receives the id and an `AbortSignal`, and its result picks the branch.
  - The Engine is paused while a Lesson started from `on interact` waits, and unpaused after.
  - A missing handler, a rejection or an `undefined` result each end the run and call `onError` with a `platformCommand` error, while the session keeps running.
  - `unmount()` mid-Battle aborts the signal, and a result resolved afterwards changes nothing.
- **Manual** (no browser automation, per `CLAUDE.md`).
  - In the reference Platform, win and give up a Battle and confirm each branch's Dialogue and Flag.
  - Confirm that the Player can't move while the overlay is open.
  - Open and close a Lesson.
  - Mount without a `battle` handler, and confirm that interacting logs the `onError` and the game keeps running.

## Out of Scope

- How a Platform learns that a Student finished a World: #77, left open and not answered by Platform commands.
- A World or a Platform declaring its own commands, and commands besides `battle` and `lesson`.
- Enum results, `match`, and a Battle outcome beyond won or gave up.
- String values beyond command arguments: string Flags, locals or interpolation.
- Any HP, death, respawn, reward or grading in the game: all Platform-owned.
- Resuming a Battle or a run after a page reload, and changing when a Zone counts as played.
- A Platform overriding `move` or `follow`.
- A Platform writing Flags directly.

## Further Notes

- `adr/0048` lists the rejected options: World-declared commands, commands declared at `mount()`, built-in Battle and Lesson constructs, Platform-pushed Flag writes, results bound to a Flag at the call site, required Platform handlers, and Platform commands allowed only in Cutscenes.
- A Battle won before a failed Flag save runs again next time. The Platform's own first-win reward rule keeps that from paying twice, so the game needs no retry or transaction.
