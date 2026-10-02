---
status: accepted (supersedes adr/0020)
---

# Scripts compile as one program into one bytecode file the Host fetches

CodeLeagues Script binds a handler with `on interact(Guard)` / `on enter(CampFireVis)` in any file (`adr/0029`), so a Script can no longer be found by its file name, the way `adr/0020`'s per-kind `entities/<id>.ts` / `zones/<id>.ts` lookup finds one. The compiler (`adr/0031`) therefore compiles every `.clsc` file under the scripts root (`apps/web/src/scripts/`, including the reserved `cast.clsc` and `prelude.clsc`) as one program. It writes one bytecode file, `apps/web/public/generated/scripts.clscb` (gitignored), which carries an index of handlers keyed by (trigger, id). The Host fetches it once at startup, the same way it fetches Maps, and looks handlers up in that index. If the file is missing, or its format version doesn't match, the Host fails at startup with a message that says so, rather than running a world with no Scripts.

Compiling the whole program at once is also what lets the compiler reject two handlers for the same (trigger, id). `interact` and `enter` keep Entity and Zone ids in separate namespaces, which preserves the per-kind boundary `adr/0020` wanted.

`next build` runs the compiler first, and a compile error fails the build. `npm run dev` runs `clsc build --watch` next to `next dev`. A compile error during dev is printed to the terminal, and the last good bytecode stays in place, so the game keeps running the previous Scripts until the error is fixed. The game picks up a recompile on page reload.

## Considered Options

- **One bytecode file per source file, looked up by id the way `adr/0020` does.** We rejected it because an `on` handler's id isn't its file name, so the Host would need an index anyway, and a duplicate handler across two files would go uncaught.
- **Import the bytecode into the bundle.** We rejected it because Turbopack has no binary-import plumbing here, while `fetch` from `public/` is already how Maps load.
- **Replace the output with an error file the Host shows as an overlay** when a dev compile fails. We rejected it for v1. The terminal is enough while the team is small, and editor support for designers is still open.
