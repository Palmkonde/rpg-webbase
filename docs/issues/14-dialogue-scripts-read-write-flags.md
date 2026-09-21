# 14: Dialogue Scripts read/write Flags

**What to build:** A Script's `ctx` is backed by real per-Student Flags, and a Dialogue choice can set one — proving Scripts can branch and persist outcomes.

**Blocked by:** 11, 12

**Status:** done

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Scripts" section (Implementation Decisions: Script context).

**Implementation deviation from the ticket text:** the ticket's own checklist says a choice "names a Flag to set as its outcome" (singular, always). During implementation this widened slightly: `.choice(text, flag)`'s `flag` is optional, so a choice can be a no-op that just ends the round with no Flag write (e.g. a "Never mind" option). Ticket 16's own scope only covers writing a *set* of Flags (one-or-more), not zero, so this doesn't belong there either — it's a small, real gap in the flat round that ticket 14 already had the seam for. `docs/spec/spec.md` is unchanged by this (it doesn't mention no-op choices either way); flag here if that should be recorded there instead.

- [x] A Script's `ctx` (stubbed in ticket 12) now reads the current Student's real Flags from ticket 11's store — `apps/web/src/game/game-canvas.tsx`'s `handleEvent` calls `flagStore.getFlags(currentStudentId)` before running the Script
- [x] A Script can offer Dialogue choices, each naming a Flag to set as its outcome — `script.ts`'s `ScriptBuilder.choice(text, flag)`, chainable like `.say()` (see deviation note above for the optional-`flag` no-op case)
- [x] Setting a Flag via a choice persists it in the Student's Flag store — `game-canvas.tsx`'s `selectChoice` calls `flagStore.setFlags(currentStudentId, { [choice.flag]: true })` when a choice names a Flag
- [x] A Script can branch its Dialogue based on a Flag already being set (e.g. a different line the second time) — `CampFire.ts` reads `ctx.flags.talked_to_campfire`/`ctx.flags.talked_to_campfire_trash` to pick a different line
- [x] Manually verified: interact with a Scripted Entity, pick a choice that sets a Flag, interact again, and confirm the Dialogue reflects the changed Flag — report the result before ticking boxes or committing — manually verified by the user: confirmed everything works
