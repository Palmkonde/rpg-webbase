---
status: accepted
---

# Platforms mount the game with a framework-agnostic `mount()` and override its UI through typed slots

A Platform starts the game by calling `mount(element, options)` from the client package, and stops it with `unmount()` on the instance that call returns. The options are the Game Service URL, the World id, a `getToken()` callback (`adr/0036`), an optional Locale, and an `onError` callback. The core package has no React. A `react` subpath adds `<Game>` and `useGame` on top of `mount`, and React is an optional peer that only that subpath needs. `mount` runs only in the browser and loads Phaser itself, so a server-rendered Platform needs no client-only wrapper. Host runtime state that is module-level today (Flags store, Student, Locale) becomes per instance, so a remount on a route change starts clean.

The returned instance is also a headless store: a snapshot of what the overlays show (Dialogue, Choices, CG, Companions, error), a way to subscribe to it, and the actions the overlays call. The package draws built-in overlays by default. They are written in Preact, bundled inside the package and rendered in their own root, so they never touch the Platform's React. The built-ins are restyled with CSS variables.

Every piece the package draws is a named **slot**. Slots can nest (`Dialogue`, `Dialogue.Portrait`, `Choices.Button`, `ErrorScreen`, ...), and one typed map lists every slot name with its props. A Platform replaces any set of slots by passing a renderer for each one. In the core a renderer is a framework-agnostic `(element, props) => { update, destroy }`. In the React adapter it is a component, rendered through a portal into the element the built-in parent leaves for that slot, so the Platform's React context still reaches it. This is FullCalendar v6's model. Overrides are a partial of the slot map, so a wrong slot name or wrong props is a type error. Adding a slot with a built-in is a semver minor. Changing a slot's props is a major. `onError` always fires, and the built-in `ErrorScreen` slot shows a default message for each error kind, including "This World was updated. Reload to continue." (`adr/0038`). `useGame` without built-ins is the escape hatch for full control.

## Considered Options

- **A React `<Game>` component as the only API.** Rejected: it ties every Platform to React, and the map's goal is any Platform.
- **Headless only** (the Platform renders every overlay). Rejected as the only mode: every Platform would have to rebuild Dialogue, Choices, CG and Companions, along with rules like "Dismiss hidden while frozen" (`adr/0030`). It survives as the escape hatch.
- **Bundle React for the built-ins.** Rejected: React Platforms would load a second copy, about 50 KB gzip, where Preact is about 4 KB.
- **Built-ins rewritten in plain DOM.** Rejected: it means rewriting the temp-ui overlays imperatively, and a nested slot then needs hand-made mount points anyway.
- **Built-ins written in React inside the adapter** (so nested overrides are plain React children). Rejected: non-React Platforms would get no built-ins.
- **Flat slots only.** Rejected: the author asked for overrides that scale past 20 slots, many of them inside an overlay.
