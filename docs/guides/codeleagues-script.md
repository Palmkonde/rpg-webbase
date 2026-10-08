# Writing CodeLeagues Script

This guide covers every feature of v1 CodeLeagues Script (`.clsc`), with an example for each. Every example compiles against the app's `cast.clsc` and `prelude.clsc`. Words with a capital letter (Flag, Speaker, Mover, Cutscene and so on) are defined in [`GLOSSARY.md`](../../GLOSSARY.md).

## Contents

- [Where Scripts live](#where-scripts-live)
- [Handlers](#handlers)
- [The cast](#the-cast)
  - [Listing a block's cast with `with`](#listing-a-blocks-cast-with-with)
- [Lines](#lines)
  - [Keyed lines: `@key`](#keyed-lines-key)
- [Comments](#comments)
- [Flags](#flags)
  - [Where Flags are stored](#where-flags-are-stored)
  - [Conditions and `if`](#conditions-and-if)
- [Choices: `choose`](#choices-choose)
- [Cutscenes and CGs](#cutscenes-and-cgs)
  - [`cutscene` and `play`](#cutscene-and-play)
  - [`cg` and `play`](#cg-and-play)
  - [Once-only blocks](#once-only-blocks)
- [Commands: `move` and `follow`](#commands-move-and-follow)
- [Companions: `companion[X]`](#companions-companionx)
- [Jumps](#jumps)
  - [`section` and `goto`](#section-and-goto)
  - [`loop` and `break`](#loop-and-break)
  - [`return`](#return)
- [Splitting files: `use` and `_private`](#splitting-files-use-and-_private)
- [Compiling and reading errors](#compiling-and-reading-errors)
- [Left out of v1](#left-out-of-v1)

## Where Scripts live

Scripts live under the scripts root of a World in the content folder, `worlds/<world>/scripts/`. Every `.clsc` file in it, including files in subfolders, is compiled together as one program. You can arrange files however suits the story.

Two file names are reserved, and every other file sees them without a `use`:

- **`cast.clsc`** declares everyone a Script can name. See [The cast](#the-cast).
- **`prelude.clsc`** belongs to the Host developers. It declares `enum Expression` and the [commands](#commands-move-and-follow). A designer only reads it.

## Handlers

A handler is a block of statements that runs when something happens in the game.

```clsc
on interact(Campfire) with Campfire {
    Campfire: "Hello there.";
}

on enter(Clearing) with Narrator {
    Narrator: "The trees open onto a quiet clearing.";
}
```

- `on interact(Id)` runs every time the Player interacts with the Entity that has that id.
- `on enter(Id)` runs the first time the Player walks into the Zone that has that id. It runs once per Student and never again.

The id is the object's `entityId` in Tiled (see [`tiled-object-authoring.md`](tiled-object-authoring.md)). `interact` ids and `enter` ids are separate namespaces, so an Entity and a Zone can share an id.

A handler can go in any file. Two handlers for the same trigger and id are a compile error, even when they're in different files.

The Player can still walk around while a handler's Dialogue shows. Interacting with something else, entering a Zone, changing Map or dismissing the Dialogue ends the handler wherever it is. To take control away from the Player, put the scene in a [`cutscene`](#cutscenes-and-cgs).

## The cast

Every name that speaks, moves or appears in a Script is declared once, in `cast.clsc`:

```clsc
// cast.clsc
speaker Narrator;
speaker Campfire;
mover Guard;
character fluffy;
```

Each declaration is one line, a kind keyword and then a name:

```text
speaker <Name>;
mover <entityId>;
character <characterId>;
```

The kind keyword decides what the name can do in a Script:

| Kind | What it is | The name must match | Can speak | Can `move` / `follow` | Can be a Companion |
|---|---|---|---|---|---|
| `speaker` | Someone with lines and no walking, such as a narrator or a Prop Entity | Nothing in Tiled, but it's the key for its Portraits (see [`dialogue-portrait-assets.md`](dialogue-portrait-assets.md)) | yes | no | no |
| `mover` | A Character Entity | The Entity's `entityId` in Tiled (see [`tiled-object-authoring.md`](tiled-object-authoring.md)), which is also its Portrait key if it speaks | yes | yes | yes |
| `character` | A Character, the appearance a Companion walks with | A Character `id` in the content folder's `library/characters/` | no | no | no |

`Player` is built in, and you never declare it. The Player is a Mover that never speaks.

The compiler doesn't check `mover` or `character` names against Tiled or the catalog. A typo there still compiles, and you'll only find it when you play the game.

### Listing a block's cast with `with`

Each handler and `cutscene` lists the cast it uses after `with`, so you can see who appears before you read the block:

```clsc
on interact(Lantern) with Narrator, Campfire {
    Narrator: "The lantern flickers.";
    Campfire: "A cousin of mine.";
}
```

- If a name is used in the block but missing from `with`, that's a compile error. This includes `Player`. The one exception is the X in `companion[X]`, which doesn't need to be listed. A Character you set it to does.
- If a name is listed but never used, the compiler prints a warning.
- The `with` list covers everything inside the block, including the bodies of `if`, `choose`, `loop` and `section`.
- A block that names nobody leaves `with` out entirely.
- A `cutscene` lists its own cast. It doesn't inherit the cast of the handler that plays it.

## Lines

A line is a Speaker, an optional Expression in parentheses, a colon, then the text in double quotes:

```clsc
on interact(Well) with Campfire, Narrator {
    Campfire(Happy): "Another visitor!";
    Campfire: "Without an Expression, I show my Neutral Portrait.";
    Narrator: "สวัสดี — Thai and any other text goes straight inside the quotes.";
    Narrator: "Only two escapes exist: \"quotes\" and a backslash \\.";
}
```

- **Expressions.** These are the values of `enum Expression` in `prelude.clsc`: `Neutral`, `Happy`, `Sad`, `Angry`, `Surprised`. A line without one shows `Neutral`.
- **Escapes.** Inside quotes, `\"` is a quote and `\\` is a backslash. Any other escape, such as `\n`, is a compile error.
- **Spacing.** Spaces inside the quotes are kept exactly as you type them.

### Keyed lines: `@key`

To take text from the String Table (the World's `strings.json`) instead of writing it inline, use `@key` in place of the quoted text:

```clsc
on interact(Signpost) with Campfire {
    Campfire(Happy): @campfire.greeting;
    choose {
        @campfire.greeting_returning;
        "Leave";
    }
}
```

The key is everything after `@`. That example reads these entries from `strings.json`, where each Locale under `table` has its own text for every key:

```json
{
  "locale": "en",
  "table": {
    "en": {
      "campfire.greeting": "Howdy! am campfire!",
      "campfire.greeting_returning": "Huh? talk to me again?"
    },
    "th": {
      "campfire.greeting": "สวัสดี! ฉันคือกองไฟ!",
      "campfire.greeting_returning": "หืม? มาคุยกับฉันอีกแล้วเหรอ?"
    }
  }
}
```

Dots in a key are just part of its name, and the keys sit flat inside each Locale rather than nested. `locale` picks the Locale the game shows.

`@key` works anywhere player-visible text goes: a line, a choice label, or a `locked(...)` reason. A key must exist in every Locale of the String Table, or the compile fails. A line has to be keyed before it can be translated. Inline English is fine while you draft.

## Comments

`//` starts a comment that runs to the end of the line. Inside quotes, `//` is ordinary text.

```clsc
// Notes for whoever edits this next.
on interact(Stump) with Narrator {
    Narrator: "A stump. // This is part of the line, not a comment.";
}
```

v1 has no `/* */` block comments.

## Flags

A Flag is a durable per-Student fact that a Script reads and writes. Declare each Flag once, with the type `bool` and a default of `true` or `false`:

```clsc
flag met_sage: bool = false;
flag bridge_fixed: bool = false;
```

- **Reading.** Use the Flag's bare name.
- **Writing.** Use `set`. The value can be `true`, `false`, or any condition.

A Flag that has never been written reads as its default.

```clsc
on interact(Sage) with Narrator {
    Narrator: "The sage nods.";
    set met_sage = true;
    set bridge_fixed = met_sage && !bridge_fixed;
}
```

A written Flag stays written, even if the Dialogue is cut short afterwards.

### Where Flags are stored

The Game Service keeps each Student's Flags, keyed by Flag name, so they survive a reload, a new tab and a new device. A Script run reads them when the game loads and every write is saved as it happens. There is no way to start a Student with a Flag already set: to test a later branch, play to it.

- **Your Flags.** A Flag you declare is stored under its own name, as `true` or `false`. A once-only marker's Flag is stored the same way. A declared Flag the Student has no stored value for reads as its default.
- **Companion Flags.** `companion[Guard]` is stored as `"companion:Guard"`, holding the Character's id while Guard is a Companion and `false` once it's dismissed.
- **Ignored entries.** Entries no Script declares belong to the Host, and Scripts can't see them. A stored Companion that no Script declares, or whose Entity is on no Map, is dismissed when the game loads.

### Conditions and `if`

Conditions combine Flags with these operators:

- `!` (not)
- `&&` (and)
- `||` (or)
- `==` and `!=` (compare)
- parentheses for grouping

From tightest to loosest, they bind in this order:

1. `!`
2. `==` and `!=`
3. `&&`
4. `||`

`if`, `else if` and `else` always take braces:

```clsc
flag has_rope: bool = false;
flag has_plank: bool = false;

on enter(Bridge) with Narrator {
    if has_rope && has_plank {
        Narrator: "You patch the bridge.";
    } else if has_rope || has_plank {
        Narrator: "You have half of what you need.";
    } else {
        Narrator: "The bridge is broken.";
    }

    // Reads as `!has_rope || (has_plank && has_rope)`.
    if !has_rope || has_plank && has_rope {
        Narrator: "Still, it's a nice view.";
    }
}
```

## Choices: `choose`

A `choose` block offers the Player a set of choices. When the picked choice's body finishes, the Script carries on below the `choose`.

```clsc
flag asked_about_owl: bool = false;
flag has_lantern: bool = false;

on interact(Owl) with Campfire {
    choose {
        // Always shown.
        "Hello, owl." => {
            Campfire: "It hoots back.";
        }
        // Hidden while the condition is false.
        "Ask about the forest" if !asked_about_owl => {
            set asked_about_owl = true;
            Campfire(Sad): "Nobody comes back from the forest.";
            choose {
                "Nobody?";
                "Never mind";
            }
            Campfire: "Well. Almost nobody.";
        }
        // Shown greyed out with the reason while the condition is false.
        "Light the path" if has_lantern else locked("You need a lantern.") => {
            Campfire(Happy): "The path glows.";
        }
        // A bare choice does nothing.
        "Leave";
    }
    Campfire: "The owl blinks.";
}
```

- **Hidden choices.** `"text" if cond => { … }` hides the choice while `cond` is false.
- **Locked choices.** `if cond else locked("reason")` shows the choice greyed out with the reason while `cond` is false, and the Player can't pick it. A locked choice can have a body, which runs once the condition holds.
- **Bare choices.** A choice that ends in `;` instead of `=> { … }` does nothing.
- **Nesting.** A `choose` can sit inside a choice body, as deep as you need.
- **Nothing to show.** If every choice is hidden, the `choose` is skipped.

## Cutscenes and CGs

### `cutscene` and `play`

A `cutscene` is a block that freezes the Player while it runs. `play(cutscene::id)` runs a Cutscene, then carries on with the line below the call:

```clsc
on interact(Elder) with Narrator {
    Narrator: "The elder clears her throat.";
    play(cutscene::elder_tale);
    Narrator: "She falls quiet again.";
}

cutscene elder_tale with Narrator {
    Narrator: "Long ago, the river ran the other way.";
}
```

A Cutscene can `play` another Cutscene. The Player stays frozen until the outermost Cutscene ends.

### `cg` and `play`

A CG is declared by its id, and `play(cg::id)` shows it. The Player is frozen while it plays, and the Script carries on once the CG ends or is skipped. The CG's art and captions live outside the Script (see [`cg-art-assets.md`](cg-art-assets.md)).

```clsc
cg river_vision;

on enter(Riverbank) with Narrator {
    play(cg::river_vision);
    Narrator: "The vision fades.";
}
```

### Once-only blocks

By default, a `cutscene` or `cg` plays every time. To play one only once, put `set <flag> = true;` after it. The marker declares that Flag for you, so you don't write a separate `flag` line. You can read the Flag like any other.

```clsc
cutscene first_sunrise with Narrator {
    Narrator: "The sun rises over the valley for the first time.";
} set seen_first_sunrise = true;

cg valley_map set seen_valley_map = true;

on enter(Valley) with Narrator {
    play(cutscene::first_sunrise);
    play(cg::valley_map);
    if seen_first_sunrise {
        Narrator: "You've seen this sunrise before.";
    }
}
```

- The Flag is written when the block finishes, including when it ends with `return`.
- Once the Flag is true, `play` skips the block.
- A run cut short partway through doesn't write the Flag, so the block plays again next time.
- A once-only marker can only set its Flag to `true`.

## Commands: `move` and `follow`

Commands are declared in `prelude.clsc`. v1 declares two, and both are allowed only inside a `cutscene`. Using one in a handler is a compile error, because Movement only happens while the Player is frozen.

```clsc
cutscene guard_patrol with Guard, Player {
    follow(Player, Guard);
    move(Guard, (9, 10));
    move(Guard, (6, 8));
}
```

| Command | What it does | Waits for it to finish? |
|---|---|---|
| `move(who, (x, y))` | Walks a Mover to a tile | Yes: the next line runs once the Mover arrives |
| `follow(follower, leader)` | Makes one Mover trail another | No: the next line runs straight away |

Both arguments are Movers, which means `Player` or a `mover` from the cast. Tiles are whole numbers.

A `follow` lasts until the Player gets control back, or until the follower is given its own `move`.

## Companions: `companion[X]`

Every `mover` comes with a Companion Flag, written `companion[X]`, and you don't declare it. Its value is either a `character` from the cast or `none`:

- Setting it to a Character recruits the Mover as a Companion.
- Setting it to `none` dismisses it.

```clsc
on interact(Stray) with Guard, fluffy {
    if companion[Guard] == none {
        Guard: "Take me with you?";
        set companion[Guard] = fluffy;
    } else if companion[Guard] == fluffy {
        Guard(Sad): "I'll wait here, then.";
        set companion[Guard] = none;
    }
}
```

- **Comparing.** A Companion Flag isn't a `bool`. Compare it with `==` or `!=` against `none` or a Character. It can't be used with `!` or as a condition on its own.
- **The Player.** `companion[Player]` is a compile error, because the Player can't be a Companion.

## Jumps

### `section` and `goto`

A block can end with named sections. `goto name;` jumps to one of them, forwards or backwards, but only within the same block.

```clsc
on interact(Riddler) with Campfire {
    Campfire: "Riddle me this.";
    goto riddle;

    section riddle {
        Campfire: "What has roots nobody sees?";
        choose {
            "A tree" => {
                Campfire(Angry): "Wrong.";
                goto riddle;
            }
            "A mountain";
        }
        Campfire(Happy): "Right!";
    }
}
```

- **Where sections go.** Sections come after the block's main body. The main body ends at the first `section`.
- **No falling through.** When a section finishes, the block ends. It never runs on into the next section.
- **Naming.** Section names must be unique within a block.

### `loop` and `break`

A `loop` repeats its body until a `break` inside it runs. A `break` leaves only the innermost loop, and putting one outside any loop is a compile error.

```clsc
on interact(Merchant) with Campfire {
    loop {
        choose {
            "Buy a marshmallow" => {
                Campfire(Happy): "Sold.";
            }
            "Leave" => {
                break;
            }
        }
    }
    Campfire: "Come again.";
}
```

### `return`

`return;` ends the current block straight away. In a played Cutscene, the block that played it then carries on below the `play`. A block also ends when it runs off its last line, or when a `section` finishes.

```clsc
flag gate_open: bool = false;

on interact(Gate) with Narrator {
    if !gate_open {
        Narrator: "Locked.";
        return;
    }
    Narrator: "The gate swings open.";
}
```

## Splitting files: `use` and `_private`

Every file is compiled, but a file can only name what it declares itself, plus the cast and the prelude. To name things declared in another file, put `use folder.file;` at the very top. For example, `use story.well;` makes the names in `story/well.clsc` (under the scripts root) visible.

```clsc
// story/well.clsc
flag heard_well_story: bool = false;

cutscene well_story with Narrator {
    Narrator: "Something glints at the bottom of the well.";
    play(cutscene::_well_ending);
}

// The leading underscore keeps this private to story/well.clsc.
cutscene _well_ending with Narrator {
    Narrator: "...and it's gone.";
    set heard_well_story = true;
}
```

```clsc
// town.clsc
use story.well;

on interact(OldWell) with Campfire {
    if heard_well_story {
        Campfire: "Again?";
    }
    play(cutscene::well_story);
}
```

- **Placement.** `use` lines go before anything else in the file.
- **Not transitive.** If `a` uses `b` and `b` uses `c`, `a` still can't see `c`'s names. `a` needs its own `use c;`.
- **Private names.** Any name that starts with `_` is private to its file. Other files can't name it, even with a `use`.
- **Unique names.** Every Flag, Cutscene, CG and cast name must be unique across the whole scripts root, private ones included, whether or not the files `use` each other.

## Compiling and reading errors

`crpg publish <world> --dry-run` compiles every Script of the World and prints the errors without uploading anything. A real Publish runs the same compile and stops on the first error.

Every error shows the file, line and column, then the source line, a caret under the problem, and a message:

```text
  --> src/scripts/campfire.clsc:10:18
   |
10 |         Campfire(Angy): "Go away!";
   |                  ^--^
   |
   = unknown Expression `Angy` (expected Neutral | Happy | Sad | Angry | Surprised)
clsc: compile failed
```

- **Duplicate handlers.** A duplicate handler prints one error at each of the two handlers.
- **Warnings.** A warning's message starts with `warning:`. Warnings don't fail the compile.
- **Fix parse errors first.** These three kinds of error are parse errors:
  - a syntax error, whose message starts with `expected …` and is often a missing `;` or `}`
  - an unknown escape
  - a tile coordinate that's too large

  While any file has a parse error, the compiler stops before its other checks. More errors can appear once you fix it.

## Left out of v1

These are deliberately not in the language, so don't go looking for them:

- **Numbers and arithmetic.** Tile coordinates in `move` are the only numbers.
- **Other Flag types.** You can only declare `bool` Flags. `companion[X]` is the only Flag that holds a Character.
- **String interpolation.** You can't put a Flag's value inside a line.
- **More escapes.** `\"` and `\\` are the only escapes.
- **`/* */` block comments.**
- **A default Speaker.** Every line names its Speaker.
- **Parameterised Cutscenes.** A Cutscene can't take arguments.
- **Cross-block jumps.** You can't `goto` a section in another block.
- **`play(dialogue::x)`.** Only Cutscenes and CGs can be played.
- **Map-entry handlers.** The only triggers are `interact` and `enter`.
- **A Follow gap.** A follower always trails right behind its leader.
- **Commands that return values.**
- **Editor support.** There's no syntax highlighting or live error squiggles yet. The compiler output in `[clsc]` is where errors show up.

The reasons behind the language's shape are in [`adr/0029`](../adr/0029-scripts-move-to-a-home-grown-parsed-language.md) to [`adr/0032`](../adr/0032-scripts-compile-as-one-program-into-one-bytecode-file-the-host-fetches.md).
