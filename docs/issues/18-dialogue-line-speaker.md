# 18: Dialogue lines carry a Speaker

**What to build:** Each Dialogue line can be attributed to a Speaker — defaulting to the owning Entity's name, but overridable to a different character or an unplaced narrator — and the Host-side overlay renders it per line.

**Blocked by:** 12

**Status:** done

**Architecture note:** see `docs/spec/spec.md`'s "Dialogue Scripts: Choices, Speakers & Localization" section (Implementation Decisions: Speaker) and `CONTEXT.md`'s "Content" vocabulary (Speaker).

**Implementation notes:** `script.ts`'s `Dialogue.lines` changed from `string[]` to `DialogueLine[]` (`{ text: string, speaker?: string }`); `createScript(defaultSpeaker?: string)` takes the owning Entity's display name once, and `.say(text, options?: SayOptions)` resolves each line's `speaker` (override, else the default, else omitted entirely) at build time — a resolved value, per spec's Testing Decisions bullet, not deferred to render time the way `visible`/`enabled` are. No Entity display name is plumbed anywhere Engine→Host today (Tiled's `name` field on the `CampFire` map object is `"Campfire (test)"`, an authoring label, not Player-facing text — see `docs/guides/tiled-object-authoring.md`), so `entities/CampFire.ts` declares its own `const SPEAKER = 'Campfire'` and passes it to every `createScript()` call, rather than deriving it from `entityId` or extending the Engine Event contract. `campFireMemories()` (the nested round under "Ask what the campfire has seen") stages a `'Narrator'`-attributed line alongside its default-attributed one, to exercise multiple speakers in one round. `dialogue-overlay.tsx` renders a resolved speaker as its own bold line ahead of the line's (indented) text; an unattributed line renders text-only.

- [x] A Dialogue line carries an optional `speaker` field (a plain string, not tied to `entityId`) — `DialogueLine`/`SayOptions` in `script.ts`
- [x] When a line's `speaker` is omitted, it defaults to the owning Entity's display name — `createScript(defaultSpeaker)`, `entities/CampFire.ts`'s `SPEAKER` constant
- [x] A Script can set a different speaker per line, including a speaker with no corresponding Entity in the world (e.g. a narrator) — `campFireMemories()`'s `.say(text, { speaker: 'Narrator' })`
- [x] The Host-side overlay renders each line's resolved speaker distinctly (e.g. a name label ahead of the line's text) — `dialogue-overlay.tsx`
- [x] The `ScriptBuilder`'s per-line speaker output is unit-tested (`node:test`) — `scripts.test.ts`
- [x] Manually verified: interact with a Scripted Entity whose Script stages two different speakers (or a narrator) across its lines, and confirm the overlay shows each one distinctly — report the result before ticking boxes or committing — confirmed by the user via screenshot: interacting with `CampFire`, then "Nice to meet you!", then re-interacting and picking "Ask what the campfire has seen" shows `Narrator` and `Campfire` as two distinct labeled blocks in the same overlay
