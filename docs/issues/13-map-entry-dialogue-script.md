# 13: Map-entry runs a dialogue Script

**What to build:** Entering a Map that has an authored Script shows Dialogue automatically, without requiring an Interaction — reusing ticket 12's script-runner/overlay against a different trigger.

**Blocked by:** 03, 12

**Status:** ready-for-agent

**Architecture note:** same ADRs as ticket 12 (`docs/adr/0008`–`0011`); the only new piece here is the trigger source (`transitioned` instead of `interacted`).

- [ ] A Map-level Script is found by naming convention from the Map's id, using the same mechanism ticket 12 built for Entities
- [ ] On `transitioned`, the target Map's Script (if one exists) runs automatically and its Dialogue renders via the same overlay ticket 12 built
- [ ] A Map with no authored Script transitions in with no Dialogue (silent no-op, not an error)
- [ ] Manually verified: transition into a Map with a Script and confirm Dialogue appears; transition into one without and confirm nothing does — report the result before ticking boxes or committing (no e2e/browser automation in this repo)
