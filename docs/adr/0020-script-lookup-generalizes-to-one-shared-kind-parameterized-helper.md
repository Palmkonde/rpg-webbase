---
status: superseded by adr/0032
---

# Script lookup-by-id generalizes to one shared, kind-parameterized helper

Entity's Script lookup (`runEntityScript`: dynamic `import()` of `./entities/<entityId>.ts`, defaulting to "no Script authored" on failure) predates Zone, and Zone needs the identical behavior for its own `zoneId`s, with Map-entry Scripts (ticket #13) wanting it too once built. We considered leaving `runEntityScript`/`entities/` untouched and hand-writing a parallel `runZoneScript`/`zones/` (and eventually a third for Map-entry) — duplicating the same import/try-catch logic per kind — and rejected it as unnecessary repetition of one already-correct mechanism. We also considered one flat, cross-kind id namespace (a single directory, any kind's Script living side-by-side) and rejected that too: an Entity and a Zone accidentally sharing a display name would then silently collide on the same Script file, with no per-kind boundary to catch it. Instead the lookup generalizes into one shared helper parameterized by kind/folder — `entities/`, `zones/`, and later a Map-entry equivalent stay separate namespaces, but the import/try-catch mechanism that finds and runs a Script by id is written once.
