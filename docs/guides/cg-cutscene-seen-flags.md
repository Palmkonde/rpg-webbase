# Naming a Zone's seen-flag

A Zone gates itself with a Flag named after its id, `<zoneId>_seen`: the Host skips a Zone whose
`<zoneId>_seen` is set, and sets it as the Zone's Script starts.

It needs no registration step: the Flag is stored the first time the Zone's Script starts.

Pick a Zone id that won't collide with another Flag once `_seen` is appended. Flags are a flat, single
Student-scoped store, so a Zone `gate` and some unrelated Flag literally named `gate_seen` would clash.

A CG or Cutscene a Script plays doesn't use this convention: it plays every time unless the Script puts a
once-only marker after it (see [Once-only blocks](codeleagues-script.md#once-only-blocks)).
