# PROTOTYPE: script syntax candidates (ticket #41, throwaway)

**Verdict: CodeLeagues Script, `.clsc`** (`.cls` was rejected because it collides with LaTeX, VB and Apex). Files: [flags.clsc](flags.clsc), [campfire.clsc](campfire.clsc), [cutscenes/campfire.clsc](cutscenes/campfire.clsc), [cutscenes/guard.clsc](cutscenes/guard.clsc), [long-dialogue.clsc](long-dialogue.clsc).

- **Blocks.** C's braces and `;`, with quoted line text.
- **Flags** work as in A. They are declared `flag x: T = default;`, read by bare name, and written with `set x = v;`. There is no `let`: a bare name is always a Flag, a Character, or an enum value.
- **Expression** is an enum usable as a value. A line with no Expression is `Neutral`. `@key` is a string-table line.
- **Calls** are function style with the subject first: `move(who, (x, y))`, `follow(follower, leader)`. One `play` takes a kind-qualified id: `play(cutscene::story)`, `play(cg::campfire_vision)`.
- **Choices.** `"text" if cond` hides the choice when the condition is false. Adding `else locked("reason")` shows it greyed out instead. A choice that does nothing is a bare `"Never mind";`.
- **Control flow.** Nesting, `section` + `goto`, and `loop` + `break` are all in. After a choice's body, execution continues below the `choose` block.
- **Composition.** `use cutscenes.guard;` loads `cutscenes/guard.clsc` from the scripts root (dots are folders), and brings in everything that file defines, referenced by kind: `cutscene::walk`. Two used files that define the same name is a compile error. Exports work like a Python module: every top-level name is exported and there is no `export` keyword. A `_name` is private to its file, and the compiler enforces that. `play(cutscene::x)` runs x to the end, then continues below.

The A/B/C files below are the candidates the verdict came from.

`CampFire.ts`, the `campfire-story` Cutscene (with its embers/stars branches inlined), and a cut-down `guard-walk` (for `follow` and the non-boolean Companion Flag), written three ways. The content is identical across the files, line for line. Open them side by side.

| | [A: indent](a-indent.txt) | [B: sections](b-sections.txt) | [C: braces](c-braces.txt) |
|---|---|---|---|
| Blocks | significant indentation | `end` closers, indentation cosmetic | `{ }` + `;` |
| A line | `Campfire (Sad): "text"` | `Campfire (Sad): text` (unquoted) | `Campfire(Sad): "text";` |
| Choice | `- "text" if cond:` | `Option "text" when cond … end` | `"text" if cond => { }` |
| Flag read / write | `met` / `set x = true` | `Recall.x` / `Recall.x = true` | `flags.x` / `flags.x = true;` |
| Expression | a keyword on the line | a keyword on the line | a first-class value (`let mood: Expression = …`) |

## Shared across all three (the type-safety story)

These are fixed whichever syntax wins:

- **Every name is declared and checked at compile time.** Flags have a declared type and default. Speakers are `Character`s. Expressions are an enum. `@key` lines must exist in the string table. Cutscene and CG ids must exist. The Companion Flag is `Character?`, not a stringly-typed `'fluffy'`.
- **`dialogue` vs `cutscene` is a type.** `move` / `follow` inside a `dialogue` is a compile error, because a Dialogue never freezes the Player and a Cutscene always does.
- **Reconvergence is "the next line".** A choice's body runs, then execution continues after the `choose` block. No `next` closures and no separate registry entries for branches.
- Errors the compiler would give, for example:
  ```
  campfire.txt:14:5  unknown Expression `Angy` (expected Neutral | Happy | Sad | Angry | Surprised)
  campfire.txt:22:9  `talked_to_campfire` is bool, got Character
  campfire.txt:31:9  `move` is only allowed in a cutscene (dialogue CampFire never freezes the Player)
  campfire.txt:40:9  no cutscene named `campfire_stroy`
  ```

## Dropped from the ticket's list

- **The Yarn-like variant** (`<<if>>`, `-> option`). Its `<< >>` noise works against reading top to bottom. B keeps Yarn's best idea, unquoted line text.

## Not decided here (left for the later tickets)

- Exactly what v1 can do: locals, operators, jumps, binding a file to an Entity or Zone. That's ticket "What can a script say and do in v1?".
- `@key` vs inline text vs Thai/multi-locale handling. That's ticket "Is dialogue text written inline or kept in the string table?". The prototypes use `@key` only where `CampFire.ts` already uses the string table.

## Name + extension: candidates

- **Tale** `.tale`
- **Hearth** `.hearth` (the first script it runs is a campfire)
- **Lore** `.lore`

## To react to

1. Which block style: A, B, or C (or a hybrid)?
2. Quoted or unquoted line text?
3. How Flags read (bare name, `Recall.x`, or `flags.x`)?
4. Should an Expression be a first-class value (C), or only a keyword on a line?
5. A name.
