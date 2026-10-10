# Adding CG art

A CG's frames are the images (`.png`, `.jpg`, `.jpeg`, `.webp` or `.gif`) in `worlds/<world>/cg/<cg-id>/` of your content folder ([`content-folder.md`](content-folder.md)), where `<cg-id>` is the name a Script declares with `cg <cg-id>;`. `crpg publish` lists them in natural filename order (`2.jpg` before `10.jpg`) and the game plays them in that order. A CG with no image fails the Publish. A `raw.*` file there is your source art, and is never Published.

A frame's caption is the String Table key `cg.<cg-id>.<n>`, with `n` counting from 1: the first frame of the CG `intro` shows the text under `cg.intro.1` in the World's `strings.json`. A frame with no such key shows the key in brackets, `[cg.intro.1]`.

Art is independent of the character-spritesheet pipeline (`adr/0014`): a frame doesn't need to match any Entity, Speaker or spritesheet.
