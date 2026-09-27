# Adding CG art

```ts
const REGISTRY = {
  'intro-1': '/assets/cg/intro/1.jpg',
  'intro-2': '/assets/cg/intro/2.jpg',
  'intro-3': '/assets/cg/intro/3.jpg',
} satisfies CgArtRegistry
```

Art is keyed by an arbitrary per-frame id (`apps/web/src/state/cg-art.ts`), independent of the
character-spritesheet pipeline (`adr/0014`) — a frame id doesn't need to match any Entity, Speaker,
or spritesheet. The extension is whatever the registry says — match your actual uploaded file.

Drop the actual image files at `assets/cg/<cg-id>/<n>.<ext>` — repo-root `assets/`, gitignored, same
convention as `assets/portraits/` and `assets/sprites/`. `apps/web/public/assets/cg` is a local
symlink into it (already set up); nothing under `assets/` needs to be committed.

To manually test the boot intro CG (`docs/spec/spec.md`'s "CG & Cutscene"), place three images at:

- `assets/cg/intro/1.jpg`
- `assets/cg/intro/2.jpg`
- `assets/cg/intro/3.jpg`

A missing file just renders a broken-image icon — timing, skip, and captions are still fully
testable without real art.
