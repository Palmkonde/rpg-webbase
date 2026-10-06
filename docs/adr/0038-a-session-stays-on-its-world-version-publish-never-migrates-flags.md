---
status: accepted (amended by adr/0040: the Asset Library has no Publish of its own, so `prune` keeps only files used by kept World Versions)
---

# A session stays on its World Version; Publish never migrates Flags

The client loads a World's live World Version once, when the Platform mounts the game, and plays that World Version until the game is mounted again. Every later fetch, including the Scripts on a Map Transition, asks for that World Version by its id, never for "live". A re-Publish therefore never changes the Maps, Scripts or art under a Student mid-session. Today's re-fetch of the Scripts on every Transition (`adr/0005`) goes away.

A Publish never reads or rewrites Students' stored Flags. What a re-Publish does to progress follows from how a run reads Flags: a declared Flag missing from storage starts at its default, and a stored Flag no longer declared is ignored and comes back if it is declared again. So a renamed Flag starts over, and a renamed Zone or once-only Cutscene plays again. The Flags API checks writes for shape only (string key, `bool | string` value, a size limit), not against the live World Version's declarations, because a session still on an older World Version keeps writing to the same Flags document. Instead, Publish compares the new World Version with the live one and shows the Author every Flag it removes or adds (declared Flags, once-only Cutscene Flags, Companion movers, Zones), and asks for confirmation before going live (`--yes` skips the prompt).

The only automatic change to stored Flags is on the client. A stored Companion whose `mover` the loaded Scripts no longer declare, or whose Entity is on no Map of the World Version, is dismissed (`companion:<id> = false`). That way a Student never keeps a dismiss button for a Companion that no longer exists.

A World Version's files stay in the bucket while it is live and for a grace period after it stops being live (3 months by default, configurable), so a long session can keep fetching. Files used by no kept World Version and not by the Asset Library's current entries are deleted by `prune`, which an Author runs from the CLI (with the Publish key, `prune --version <id>` also retires one World Version early, but refuses the live one) and an operator can schedule as a service command. A session whose files are gone shows "This World was updated. Reload to continue."

## Considered Options

- **Switch to the live World Version at the next Map Transition.** Rejected: the Student could land on a Map or Spawn Point the new World Version no longer has, with Companions and Script state left over from the old one.
- **Push a "new version, reload" notice to playing Students.** Rejected: it's a push channel for a rare event, and pinning the World Version per session already makes a re-Publish safe.
- **Migrate stored Flags at Publish** (rename, clear, or retype them). Rejected: Flags types can't change today (Script Flags are `bool`, Companion Flags `Character?`, in separate name spaces), and a removed Flag that is left alone can be restored by declaring it again.
- **Refuse a Publish that removes a Companion some Student has recruited.** Rejected: it needs a query across every Student, and an Author could never remove a Companion once anyone had recruited it.
- **Keep every World Version's files forever.** Rejected by the author: the bucket would only grow.
