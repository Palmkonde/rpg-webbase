# Adding Dialogue Portrait art

A Portrait is the face shown beside a Speaker's Dialogue line. Each Speaker has one image per Expression, in the World's content folder ([`content-folder.md`](content-folder.md)):

```text
worlds/<world>/portraits/<Speaker>/<expression>.png
```

`<Speaker>` is the name a Script declares with `speaker` or `mover`, in the same case: `portraits/Guard/` for `mover Guard;`. `<expression>` is one of these Expressions, in lower case:

| Expression in a Script | File |
|---|---|
| `Neutral` | `neutral.png` |
| `Happy` | `happy.png` |
| `Sad` | `sad.png` |
| `Angry` | `angry.png` |
| `Surprised` | `surprised.png` |

A Script picks the Portrait in a line, `Guard(Angry): "Halt!"`, as [`codeleagues-script.md`](codeleagues-script.md) describes. A line with no Expression shows `neutral.png`. A Speaker without that file shows no Portrait for such a line, and `crpg` doesn't ask for it. A Speaker with no Portraits at all needs no folder.

Portraits are PNG only. A `raw.*` file in a Speaker's folder is your source art, and is never Published.

`crpg publish` fails when:

- a line uses `Speaker(Expression)` and that Speaker has no file for that Expression
- a folder under `portraits/` holds Portraits for a name no Script declares as a `speaker` or `mover`
- a PNG in a Speaker's folder isn't named for one of the five Expressions

Portraits are their own art, separate from Character sheets (`adr/0014`). A Portrait doesn't need to match any Entity, Character or sprite.
