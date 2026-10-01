---
status: accepted
---

# A Rust compiler emits bytecode at build time, and a TypeScript VM runs it

CodeLeagues Script (`adr/0029`) needs a compiler and a runtime. The research behind this (`docs/research/parser-implementation-language.md`, on branch `research/parser-implementation-language`) showed that plain TypeScript would have been enough: it parses a 5 KB script in about 1 ms, and a build-time step saves nothing at runtime. We chose Rust for the compiler anyway, because the point of `adr/0029` is to learn language implementation by building one, and the dev building it wants to learn Rust while doing so. The compiler is written in Rust with the pest parser library and runs only at build time, never in the browser. It emits binary bytecode. The VM from `adr/0030` is written in TypeScript and runs in the browser on the Host side. The split is permanent rather than a stepping stone. Moving the VM to Rust/WASM later would be a separate effort.

Because Rust writes the bytecode and TypeScript reads it, the format is a contract between two languages that `tsc` can't check:
- The opcode table lives in Rust, and the crate's `build.rs` generates the TypeScript opcode constants from it.
- Every compiled file starts with a magic number and a format version. The VM refuses a version it doesn't expect, with an error that names both versions, rather than misreading the bytes.
- Rust tests write fixture bytecode files, and the TypeScript tests decode those same files.
- A `clsc disasm` command prints bytecode as text, because a binary format nobody can read can't be debugged.

Everyone who runs the app locally, designers included, works inside the repo's Nix dev shell (`flake.nix`). The shell provides the pinned Rust toolchain, and the build compiles the compiler from source. There is no prebuilt compiler binary. How a future deploy target gets the compiler is left until a deploy target exists.

## Considered Options

- **All TypeScript.** This means one toolchain, and the compiler could run in the browser for in-game error overlays and hot reload without a watcher. We rejected it for the learning goal: lexing, parsing, compiling and running a VM are no harder to learn in TypeScript, but learning Rust is part of what the team wants from this effort.
- **Rust for both, compiled to WASM.** We rejected this because of the friction the research found on Next 16/Turbopack: wasm-bindgen's bundler target doesn't work there, so loading needs `--target web` or `public/`. There would also be string copies at the boundary, UTF-8→UTF-16 offset mapping for every error position, and a JS↔WASM crossing at every VM step.
- **JSON instructions with TypeScript types generated from Rust (`ts-rs`).** This would have made a format mismatch a `tsc` error. We chose binary bytecode for the experience of building a real one, and pay for it with the version header, shared fixtures and `disasm` above.
- **A hand-written parser, chumsky, or lalrpop.** pest keeps the grammar in its own file, which reads like the language's grammar on paper, and it suits a dev with no parsing background. The cost is generic error messages. chumsky recovers from errors better but has heavy generic types. lalrpop needs LR theory to make sense of its shift/reduce conflicts.
- **A prebuilt compiler binary** (GitHub Release plus npm `postinstall`) so that teammates without Rust could build. We dropped it once Nix became a requirement for every local build, which left the binary with no user.
