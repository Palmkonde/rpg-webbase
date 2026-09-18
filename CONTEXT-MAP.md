# Context Map

This repo is split by contract-sharing, not clean per-package boundaries — see `docs/agents/domain.md` for why.

- **Shared (Engine↔Host contract)** — [CONTEXT.md](./CONTEXT.md), decisions in [docs/adr/](./docs/adr/)
- **`packages/engine-core`** — package-internal vocabulary/decisions only; no `CONTEXT.md`/`docs/adr/` yet (created lazily by `/domain-modeling` when needed)
- **`apps/web`** — package-internal vocabulary/decisions only; no `CONTEXT.md`/`docs/adr/` yet (created lazily by `/domain-modeling` when needed)
