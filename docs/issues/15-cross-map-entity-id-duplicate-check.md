# 15: Cross-Map entityId duplicate-check script

**What to build:** A standalone dev script, run manually (not wired into `npm test`/`npm run lint`), that reads every Map in the maps catalog and reports any `entityId` reused by two different Entity objects across different Maps — catching an authoring mistake the Engine itself can't see, since it only ever loads one Map at a time.

**Blocked by:** 05

**Status:** ready-for-agent

**Architecture note:** see `docs/adr/0012-map-objects-any-layer-dedicated-identity-property.md` and `docs/spec/spec.md`'s "Map Object Authoring" section. Reuses `collectEntities` and `findDuplicates` from `packages/engine-core` — no new duplicate-detection logic, just a new call site over the combined `entityId` list from every Map instead of one.

- [ ] The script reads every Map's Tiled JSON from the maps catalog (not just the currently-loaded one)
- [ ] It collects each Map's Entities via the existing `collectEntities`, then finds any `entityId` shared across two or more different Maps via the existing `findDuplicates`
- [ ] For each collision found, it reports the `entityId` and which Maps it spans
- [ ] It reports cleanly (e.g. a non-zero-ish confirmation or "no collisions found" message) when nothing collides
- [ ] Not wired into `npm test` or `npm run lint` — run on demand only
- [ ] No new test suite for the script itself; it's a thin I/O wrapper around already-tested pure functions (`collectEntities`, `findDuplicates`)
