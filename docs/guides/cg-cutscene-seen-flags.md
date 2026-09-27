# Naming a CG/Cutscene's seen-flag

`runOnce` (`apps/web/src/state/flags.ts`) derives a CG/Cutscene's "already played" Flag key from its id:

```ts
const seenKey = `${id}_seen`
```

So `playCG('intro')` reads and writes the Flag `intro_seen` — no separate registration step, and
nothing to add to the seed fixture unless you want it pre-seeded as already seen. This matches the
existing `tutorial_seen` convention already in `apps/web/src/fixtures/student-state.json`.

Pick a CG/Cutscene id that won't collide with another Flag once `_seen` is appended — Flags are a
flat, single Student-scoped store (`docs/spec/spec.md`'s "CG & Cutscene"), so an id of `intro` and
some unrelated Flag literally named `intro_seen` would clash.
