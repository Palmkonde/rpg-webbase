# 14: Dialogue Scripts read/write Flags

**What to build:** A Script's `ctx` is backed by real per-Student Flags, and a Dialogue choice can set one — proving Scripts can branch and persist outcomes.

**Blocked by:** 11, 12

**Status:** ready-for-agent

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Scripts" section (Implementation Decisions: Script context).

- [ ] A Script's `ctx` (stubbed in ticket 12) now reads the current Student's real Flags from ticket 11's store
- [ ] A Script can offer Dialogue choices, each naming a Flag to set as its outcome
- [ ] Setting a Flag via a choice persists it in the Student's Flag store
- [ ] A Script can branch its Dialogue based on a Flag already being set (e.g. a different line the second time)
- [ ] Manually verified: interact with a Scripted Entity, pick a choice that sets a Flag, interact again, and confirm the Dialogue reflects the changed Flag — report the result before ticking boxes or committing
