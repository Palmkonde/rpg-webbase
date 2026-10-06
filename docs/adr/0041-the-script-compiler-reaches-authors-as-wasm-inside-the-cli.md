---
status: accepted
---

# The Script compiler reaches Authors as WASM inside the CLI

Publish compiles a World's Scripts on the Author's machine (`adr/0040`), but Authors install this project without Rust or Nix. The clsc compiler (`adr/0031`) is therefore built for `wasm32` from its in-memory entry point, `compile_sources`, and shipped inside the Publish CLI's npm package. The CLI runs on Node or Bun: it uses only `fetch`, `fs`, and `crypto`, and no `Bun.*` APIs. So an Author needs a JavaScript runtime and nothing else, on any OS. Contributors to this repo keep using the native `cargo` build for development and tests (`adr/0033`).

## Considered Options

- **Prebuilt native binaries per OS and CPU, as optional npm dependencies (esbuild's model).** Rejected: faster to run, but it needs a CI build matrix and five or more extra published packages, for a compile that takes milliseconds.
- **Require cargo or Nix on the Author's machine.** Rejected: this project has to be installable by people who aren't developers in this repo.
- **A Bun-only CLI.** Rejected: an Author is more likely to have Node installed, and avoiding `Bun.*` in the CLI costs almost nothing.
