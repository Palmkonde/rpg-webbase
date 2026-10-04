# Naming a seen-flag

Two things outside a Script gate themselves with a Flag named after their id, `<id>_seen`:

- **The boot CG.** `runOnce` (`apps/web/src/state/flags.ts`) plays `intro` only while `intro_seen` isn't
  set, and sets it once the CG ends.
- **A Zone.** The Host skips a Zone whose `<zoneId>_seen` is set, and sets it as the Zone's Script starts.

Neither needs a registration step or a seed entry, unless you want one pre-seeded as already seen. This
matches the existing `tutorial_seen` convention in `apps/web/src/fixtures/student-state.json`.

Pick an id that won't collide with another Flag once `_seen` is appended. Flags are a flat, single
Student-scoped store, so an id of `intro` and some unrelated Flag literally named `intro_seen` would clash.

A CG or Cutscene a Script plays doesn't use this convention: it plays every time unless the Script puts a
once-only marker after it (see [Once-only blocks](codeleagues-script.md#once-only-blocks)).
