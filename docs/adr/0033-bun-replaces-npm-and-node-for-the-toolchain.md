---
status: accepted
---

# Bun replaces npm and Node for the toolchain

Bun is the package manager, script runner and test runner. `bun.lock` replaces `package-lock.json`, workspace scripts fan out with `bun run --filter '*'`, and every package's `test` script runs `bun test`. The Nix dev shell (`flake.nix`) provides Bun and no Node. Tools whose bin starts with `#!/usr/bin/env node` (`next`, `tsc`, `oxlint`, `concurrently`) still work, because `bun run` puts a `node` on `PATH` that points at Bun when no real Node is installed. So with no other Node on `PATH`, Next's dev server and build run on Bun's runtime. A Node installed outside the dev shell takes precedence over Bun's `node`.

The tests keep importing `node:test` and `node:assert/strict`. `bun test` runs those files unchanged, so the suites don't depend on `bun:test` and a rollback to `node --test` is a script change, not a rewrite. The one gap found was `context.mock.method`, which Bun's `node:test` doesn't implement. Tests swap globals by hand and restore them in a `finally`. That restore matters more under Bun, because `bun test` runs every file in one process, while `node --test` gives each file its own.

`bun test` (Bun's built-in runner) and `bun run test` (the `test` script) are different commands. At the repo root, only `bun run test` runs `cargo test` and compiles the clsc fixtures before the VM tests.

## Considered Options

- **Keep npm and Node.** Nothing was broken. We switched for faster installs and tests, and for one runtime that runs TypeScript directly.
- **Bun as package manager only.** Leaving `node --test` in place would have kept two runtimes in the dev shell for no gain, since the suites already pass under `bun test`.
- **Rewrite the tests to `bun:test`.** We rejected this because it ties every test file to Bun and drops the `node --test` fallback, while `node:test` works as is.
- **Keep Node in the dev shell next to Bun.** This is the safer setup for Next, which officially targets Node. We dropped Node anyway to stay on one runtime, and accept that a Next feature Bun doesn't support would surface here first.
