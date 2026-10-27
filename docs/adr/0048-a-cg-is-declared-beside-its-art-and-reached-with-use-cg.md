---
status: accepted (amends adr/0032: the program compiles the World's CG files as well as the scripts root)
---

# A CG is declared beside its art and reached with `use cg.<id>;`

Every CG is declared in one file, `cg/<id>/cg.clsc`, in the same folder as its frames. Scripts under the scripts root never declare a `cg`. A file there that `play`s one writes `use cg.<id>;`, where `cg.` is a reserved prefix meaning "the World's `cg/` folder", so a `cg/` folder under the scripts root is a compile error. The declaration's name must match its folder. The once-only marker stays on that declaration (`cg intro_fox set seen_intro_fox = true { … }`), and any file that `use`s the CG can read the Flag. The CG file's own `use` lines reach into the scripts root as usual, for the Flags its `if`s check.

A declaration may have a body. A body holds only `frame` steps, Captions (inline English or `@key`) and `if` on Flags. It must start with a `frame` that is not inside an `if`. A `frame` names its image by file stem (`frame("fox_wave")` shows `fox_wave.png`). Each Caption is one click, and a `frame` with no Caption after it is one silent click. These are compile errors: an unknown stem, and an image no `frame` names (`raw.*` excepted). A bodyless `cg <id>;` plays every image in natural filename order with no Caption. A `cg/<id>/` folder with images but no `cg.clsc` gets a publish warning, not an error. The old rule that frame `n` takes its caption from the String Table key `cg.<id>.<n>` is removed with no fallback.

## Considered Options

- **Keep `cg` declarations in the scripts root, with or without a body.** Rejected. The art, the frame names and the Captions that go with each frame would live in two folders, and a frame stem would be checked against a folder far from the code that names it.
- **Body CGs in their folder, bodyless CGs in the scripts root.** Rejected. Two homes for one kind of thing is the confusion this change exists to remove.
- **Keep the `cg.<id>.<n>` key rule as a fallback for bodyless CGs.** Rejected. A Caption would then have two ways to exist, one of them invisible from any `.clsc` file.
- **Name a frame by position (`frame(2)`).** Rejected. Adding an image would silently shift every later frame.
- **One Caption per frame, in order.** Rejected. One picture often carries several Captions, as an intro or a Chapter title card does.
