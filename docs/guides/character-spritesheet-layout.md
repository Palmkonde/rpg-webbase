## The canonical layout

`grid-engine`'s default character-animation model (`characterIndex`) expects a fixed grid: one row of 3 frames per cardinal direction.

```
                    col 0            col 1            col 2
                 (left foot)       (standing)       (right foot)
              ┌────────────────┬────────────────┬────────────────┐
   row 0      │                │                │                │
   DOWN       │   frame 0      │   frame 1      │   frame 2      │
              │                │                │                │
              ├────────────────┼────────────────┼────────────────┤
   row 1      │                │                │                │
   LEFT       │   frame 3      │   frame 4      │   frame 5      │
              │                │                │                │
              ├────────────────┼────────────────┼────────────────┤
   row 2      │                │                │                │
   RIGHT      │   frame 6      │   frame 7      │   frame 8      │
              │                │                │                │
              ├────────────────┼────────────────┼────────────────┤
   row 3      │                │                │                │
   UP         │   frame 9      │   frame 10     │   frame 11     │
              │                │                │                │
              └────────────────┴────────────────┴────────────────┘
```

## Finding the real frame size in a downloaded sheet

Don't guess the per-frame pixel size from a zoomed-up render — pixel art at 4x-8x scale is easy to miscount, and a canvas frequently has dead padding around the real content (e.g. an export that pads to a fixed page size). Derive it from the alpha channel instead: dump every pixel and find the transparent gutters between frames.

```bash
magick path/to/raw.png txt:- > /tmp/pixels.txt

awk -F'[ ,:()]+' '
NR==1 { w=$5; h=$6; next }
{ x=$1; y=$2; a=$6; if (a+0 > 0) { colhas[x]=1; rowhas[y]=1 } }
function ranges(arr, maxv,    i, start, inrun) {
  inrun=0
  for (i=0; i<=maxv; i++) {
    if (arr[i]) { if (!inrun) { start=i; inrun=1 } }
    else { if (inrun) { print start"-"(i-1)" (len="(i-start)")"; inrun=0 } }
  }
  if (inrun) print start"-"maxv" (len="(maxv-start+1)")"
}
END { print "COLUMNS:"; ranges(colhas, w-1); print "ROWS:"; ranges(rowhas, h-1) }
' /tmp/pixels.txt
```

`w`/`h` come off the `txt:-` header line (`# ImageMagick pixel enumeration: <w>,<h>,...`) so the bounds always match the sheet you're actually measuring, not whatever sheet you last measured.

The contiguous ranges are the real content bands; the gaps between them are gutters, and the distance between band starts is the frame pitch. Worked example, Temmie (`assets/sprites/characters/temmie/`): columns `1-29, 33-61, 65-93`, rows `6-31, 38-63, 70-95, 102-127` — band starts 32px apart on both axes, so the real frame tile is **32x32**, even though the source canvas was 168x280. Content only filled the top-left 3 cols x 4 rows (96x128); the rest of the canvas was empty padding invisible at a glance in a shrunk-down render.

## Filling a missing direction

When a source sheet has no real art for one or more directions (see `docs/adr/0006-normalize-downloaded-character-sheets-into-grid-engines-canonical-layout.md`), duplicate an available direction's row verbatim into the missing slots — don't synthesize (mirror/rotate) and don't leave a row blank:

```bash
magick raw.png -crop <rowWidth>x<frameHeight>+0+0 +repage down-row.png
magick down-row.png down-row.png down-row.png down-row.png -append normalized.png
```

This crops the one real direction's row (here, "down") and vertically appends four copies of it, producing a canonical-shaped sheet where every direction plays the same real frames.

## Tooling

This repo has no ImageMagick dependency of its own; get it via the Nix flake at the repo root:

```bash
nix develop --command bash -c '<imagemagick commands here>'
```

The first run in a fresh environment populates the Nix store (imagemagick + its build closure) and can take several minutes; subsequent runs are fast.
