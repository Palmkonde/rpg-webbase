# Client package distribution: registry, shape, dependencies, guardrails

## 1. Question and scope

Ticket [#67](https://github.com/Palmkonde/rpg-webbase/issues/67), a child of map [#65](https://github.com/Palmkonde/rpg-webbase/issues/65), asks how a **client package** gets from this Bun workspace into another team's monorepo. It has to work for strangers too, not only for the author's platform. The five sub-questions are:

- the distribution channel;
- the package's shape (TS source or built JS);
- `phaser`, `grid-engine` and `react` as peer or regular dependencies;
- bundling the clsc VM without the Rust compiler;
- guardrails that keep the licensed `assets/` out of any package.

This note gathers facts and runs small experiments. It does not decide anything. The decisions belong to grilling and an ADR, as #65 says. Where the evidence points clearly one way, the note says **leaning**.

**Repo state at the time of writing:**

- **`engine-core`** (`packages/engine-core/package.json`) is `private: true` and ships TS source (`main`/`types: src/index.ts`). Its relative imports use `.ts` extensions under `allowImportingTsExtensions`. It depends on `phaser ~4.0.0` and `grid-engine ^2.52.1`.
- **`@game-engine/clsc`** is `private: true`. Its `main` is `vm/src/program.ts`, and the package also contains `compiler/` (Rust) and `vscode/`.
- **`apps/web`** depends on both packages as `"*"`, not `workspace:*`. It lists them in `transpilePackages` (`apps/web/next.config.mjs`).
- **Tool versions:** next 16.3.5 (Turbopack), bun 1.4.2, npm 10.9.8, tsc 5.9.3. phaser 4.0.0 and grid-engine 2.52.1 are installed.
- **The repo** is public on GitHub, with **no LICENSE file**.

## 2. Findings in brief

- **Distribution.** Public **npm** is the only channel that lets a stranger install with no account, token or registry config.
  - **GitHub Packages** needs a token with `read:packages` from every installer, even for public packages, plus a scoped `.npmrc`. It also forces the scope to equal the GitHub owner (`@palmkonde`).
  - **Git dependencies** can't target a package in a monorepo subdirectory with npm or Bun. Only pnpm documents a way (`#path:`). npm also runs `prepare` with devDependencies, which drags the build toolchain onto the consumer.
  - **Tarballs** work everywhere but have no update channel (§3).
- **Shape: built ESM JS plus `.d.ts`, not TS source.**
  - Next.js does not compile `node_modules` code unless the package is in `transpilePackages`.
  - Node refuses `.ts` files under `node_modules` and says so in order to discourage publishing TS.
  - A Bun.build of engine-core and the clsc VM gives one 32 KB ESM file whose only bare imports are `phaser` and `grid-engine`.
  - `tsc --emitDeclarationOnly` works with the existing `.ts`-extension imports (§4).
- **Internal packages must be bundled in, never listed as dependencies.** `@game-engine/engine-core` and `@game-engine/clsc` are unpublished and resolve as `"*"`. Today both names return 404 on npm. If the published manifest listed them, a stranger's install would fail, or would fetch whatever someone else later publishes under that scope (§4.3).
- **Phaser twice.** Phaser's ESM build sets no global, and grid-engine imports only `Tilemaps` (for the `Orientation` constants) from it. So two copies don't break at runtime. What a second copy does cost:
  - about 1.3 MB of minified Phaser, shipped twice;
  - TypeScript type-identity mismatches, because the public `.d.ts` reaches into Phaser's types.

  React is different. Two copies break hooks, so `react`/`react-dom` must be peers *if* the package exports React components. Whether it does depends on #72 (§5).
- **The clsc VM bundles cleanly.** The bundle's inputs are 8 distinct engine-core files and 3 `clsc/vm/src` files, with nothing from `compiler/` or `vscode/`. The VM has no npm dependencies (§6).
- **Guardrails.**
  - Use a `files: ["dist"]` allowlist. When it is present, root `.npmignore`/`.gitignore` are ignored.
  - With bun 1.4.2 and npm 10.9.8, a symlink to a licensed folder placed *inside* `dist/` was **not** packed.
  - The allowlist does not catch art the bundler **inlines** into JS. That needs a second check on the bundle's inputs and the packed manifest (§7).

## 3. Distribution channels

| Channel | What the consumer needs | Versions / updates | Notes |
|---|---|---|---|
| **Public npm** | Nothing: the default registry. | Semver ranges, `npm update`/`bun update`, dist-tags (`--tag`). | Scoped packages publish as private by default, so they need `--access public` or `publishConfig` ([npm: scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages)). You must own the user or org whose name is the scope (same source). Optional `--provenance` from GitHub Actions needs a public `repository` ([npm: provenance](https://docs.npmjs.com/generating-provenance-statements)). This repo is public. |
| **GitHub Packages** | An `.npmrc` with `@OWNER:registry=https://npm.pkg.github.com` and `//npm.pkg.github.com/:_authToken=TOKEN`. "You need an access token to publish, install, and delete private, internal, and public packages." Installing needs a `read:packages` token ([GitHub docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)). | Semver, same as npm. | "GitHub Packages only supports scoped npm packages", and the namespace is the owner account (same source). Every stranger's CI needs a PAT, which rules it out for "anyone can install". |
| **Git dependency** | Git access to the repo. Specs: `github:user/repo#commit-ish` or `#semver:<range>` against tags ([npm install](https://docs.npmjs.com/cli/v11/commands/npm-install); [Bun install](https://bun.com/docs/pm/cli/install)). | Pinned to commit/tag. Updates mean editing the spec. | npm documents no way to install a monorepo **subdirectory** (`packages/client`). pnpm does (`#path:/packages/...`, [pnpm package sources](https://pnpm.io/package-sources)). Bun's docs show no such option. With npm, "If the package being installed contains a `prepare` script, its `dependencies` and `devDependencies` will be installed, and the prepare script will be run" ([npm install](https://docs.npmjs.com/cli/v11/commands/npm-install)). A Bun build script there breaks consumers who have only npm. Bun also skips dependency lifecycle scripts unless `trustedDependencies` lists them ([Bun install](https://bun.com/docs/pm/cli/install)). |
| **Tarball** | A `.tgz` file path or `https://` URL ([npm install](https://docs.npmjs.com/cli/v11/commands/npm-install); [pnpm](https://pnpm.io/package-sources)). | None. Each update is a new file or URL. | Fine for trying out a pre-release (`bun pm pack` → `bun add ./x.tgz`). Not a release channel. |

**Leaning:** publish to public npm, under a scope the project owns. Before any of that, the project needs a LICENSE, since strangers otherwise have no right to use the code. Both are open questions (§8).

## 4. Shape of the published package

### 4.1 TS source vs built JS

- **Next.js:** "Turbopack transpiles workspace packages … in your monorepo automatically", but "Next.js does not compile code inside `node_modules` by default." A dependency that ships raw TS has to go in `transpilePackages`, or else you "build the package to plain JavaScript and point its `main`/`exports` at the compiled output" ([`transpilePackages`, Next 16.3](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)). Once the package comes from a registry it is in `node_modules`, so TS source makes every Next consumer edit their config.
- **Node:** "To discourage package authors from publishing packages written in TypeScript, Node.js refuses to handle TypeScript files inside folders under a `node_modules` path" ([Node TypeScript docs](https://nodejs.org/api/typescript.html)). Any test runner or SSR path in a consumer that loads the package through Node fails on TS source.
- **Fit with today's sources.** `allowImportingTsExtensions` "is only allowed when `--noEmit` or `--emitDeclarationOnly` is enabled". The expectation is that a bundler resolves the `.ts` imports ([tsconfig reference](https://www.typescriptlang.org/tsconfig/#allowImportingTsExtensions)). So the JS should come from a **bundler** (Bun.build) and only the declarations from `tsc`. That needs no source edits. `rewriteRelativeImportExtensions` (TS 5.7) would let `tsc` emit JS instead, but it does "not" rewrite declaration files ([TS 5.7 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html)).

### 4.2 Experiment: bundle + declarations

The scripts are in the appendix.

- **Bundle.** `Bun.build` with `format: 'esm'`, `target: 'browser'`, `external: ['phaser','grid-engine','react','react-dom']`, on an entry that re-exports `engine-core/src/index.ts` and `clsc/vm/src/program.ts`. It succeeded and produced **one `index.js`, 32,490 bytes**, whose only bare imports are `from "grid-engine"` (×3) and `from "phaser"` (×2). Bun's `external` "leaves the import statement as-is, to be resolved at runtime" ([Bun bundler](https://bun.com/docs/bundler)).
- **Declarations.** `tsc --emitDeclarationOnly` (5.9.3) on the same two entries emitted 13 `.d.ts` files with no errors. The emitted files **keep** `.ts` specifiers (`export { createEngine } from './engine.ts'`). Bun.build emits no `.d.ts`: it "is not intended to replace `tsc` for … generating type declarations" ([Bun bundler](https://bun.com/docs/bundler)).
- **Consumer check.** A consumer importing those `.d.ts` typechecked cleanly under both `moduleResolution: "bundler"` and `"NodeNext"`. It did not use `allowImportingTsExtensions` and had `skipLibCheck` off. The only errors were Phaser's own `phaser.d.ts` errors, which is why this repo sets `skipLibCheck`.
  - **Caveat:** this was checked only with a TS 5.9.3 consumer. Older TS versions on the consumer side are untested.
- **Phaser in the public types.** The public `.d.ts` reaches Phaser's types transitively (`index.d.ts` → `map-scene.d.ts` → `import * as Phaser from 'phaser'`). A consumer's typecheck therefore needs `phaser` resolvable, which it is whether Phaser is a peer or a regular dependency.

### 4.3 Workspace packages: bundle them in, don't depend on them

`apps/web` refers to the internal packages as `"*"`. `bun publish` "strips catalog and workspace protocols … resolving versions if necessary" ([bun publish](https://bun.com/docs/pm/cli/publish)), but a bare `"*"` is not a workspace protocol. So a published client whose `dependencies` included `@game-engine/engine-core: "*"` would send installers to the public registry for it. `npm view @game-engine/engine-core` and `npm view @game-engine/clsc` both returned **404** on 2026-10-05: the install fails today, and could fetch someone else's code if the scope is ever claimed.

**Leaning:** publish **one** package. engine-core and the VM are bundled into `dist/` and listed under `devDependencies` (or not listed at all), with only third-party runtime deps under `dependencies`/`peerDependencies`. Publishing engine-core and clsc as separate packages would triple the release surface, for consumers who only ever mount the game.

### 4.4 ESM-only and `"use client"`

- **ESM only.** Bun's bundler defaults to ESM; `cjs` is "experimental" ([Bun bundler](https://bun.com/docs/bundler)). Phaser's own `exports` map points `import` at `dist/phaser.esm.js` (`node_modules/phaser/package.json`). An ESM-only `exports: { ".": { "types", "import" } }` is enough for Next/Turbopack and other modern bundlers. Nothing here needs `require`.
- **`"use client"`.** Next advises library authors to "add the `"use client"` directive to entry points that rely on client-only features", and warns that "some bundlers might strip out `"use client"` directives" ([Next: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)). Bun.build does strip it: an entry beginning with `'use client'` came out without it. Bun's `banner` option exists for exactly this: "This can be a directive like `"use client"` for React" ([Bun bundler](https://bun.com/docs/bundler)).
  - **Whether it's needed** depends on #72. A React component export needs the banner. A framework-agnostic `mount(el)` called from the platform's own client component does not.
- **SSR.** The engine touches `window`/canvas, and `apps/web` already imports it only from `'use client'` files (`apps/web/src/game/game-canvas.tsx`).

## 5. Peer vs regular dependencies

**The rule.** Peer dependencies express "compatibility with host tools/libraries … without requiring them as direct dependencies". npm 7+ installs them automatically ([npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)), and so does Bun: "`bun install` installs them automatically" ([Bun install](https://bun.com/docs/pm/cli/install)). Making something a peer therefore costs the consumer little.

- **React and react-dom:** peer, if the package renders React.
  - "In order for Hooks to work, the `react` import from your application code needs to resolve to the same module as the `react` import from inside the `react-dom` package." Two copies cause the invalid-hook-call error. React's docs name "a library you're using incorrectly specifies `react` as a dependency (rather than a peer dependency)" as a cause ([React: duplicate React](https://react.dev/warnings/invalid-hook-call-warning)).
  - If #72 lands on a vanilla `mount(el)` with no React inside, React isn't a dependency at all.
- **phaser.** What two copies actually do here:
  - **Runtime:** no break shown. Phaser's ESM dist (`dist/phaser.esm.js`) does not assign a global; only the CJS `src/phaser.js` runs `global.Phaser = Phaser`. grid-engine's ESM build imports just `{ Tilemaps }` from `"phaser"`, for `Orientation.ISOMETRIC` comparisons (`node_modules/grid-engine/dist/GridEngine.esm.min.js`). No runtime failure from a second copy was found or reproduced.
  - **Size:** `phaser.min.js` is 1.3 MB, so a second copy ships it twice.
  - **Types:** because the public `.d.ts` exposes Phaser types (§4.2), a consumer with a different Phaser version can get type-identity mismatches.
  - **Upstream precedent:** grid-engine, a Phaser plugin, takes the peer route: `peerDependencies: { phaser: "~4.0.0" }`, plus phaser in `devDependencies`, plus `esbuild --external:phaser` (its `package.json`).
- **grid-engine:** its own peer is `phaser ~4.0.0`, so whatever phaser range the client declares has to fit inside `~4.0.0`. Otherwise:
  - npm's default resolves conflicting deep peers "using the nearest non-peer dependency specification, even if doing so will result in some packages receiving a peer dependency outside the range";
  - with `--strict-peer-deps`, conflicts are "treated as an install failure" ([npm config: `strict-peer-deps`](https://docs.npmjs.com/cli/v11/using-npm/config)).
- **Leaning:**
  - `react`/`react-dom` → `peerDependencies`, only if #72 exports React.
  - `phaser` and `grid-engine` → regular `dependencies`, kept external to the bundle.

  Reasoning: Phaser is an implementation detail the platform never imports. Since peers auto-install anyway, the real difference is who picks the version, and the client package should pick it, because grid-engine pins `~4.0.0`.

  Making phaser a peer is the alternative to grill. It is the better choice only if platforms are expected to run their own Phaser next to the game.

## 6. Bundling the clsc VM without the Rust compiler

- The VM (`packages/clsc/vm/src/{program,run,opcodes}.ts`) has no npm imports.
- The unminified bundle's source-path comments list every input: 8 distinct `packages/engine-core/src/*` modules and 3 `packages/clsc/vm/src/*` modules. Bun repeats a path comment whenever hoisting switches module, and `index.ts`/`types.ts` add no runtime code. There are none from `packages/clsc/compiler` (Rust) or `packages/clsc/vscode`.
- The bundler only follows imports. Since nothing in the VM imports the compiler, `cargo` never runs and no Rust artefact can enter `dist/`.
- The `.clscb` bytecode files are content produced by the compiler at Publish time (#73). They are not part of the package.
- **One trap.** The clsc package's `main` points into `vm/src`, but the package directory also holds `compiler/` and `vscode/`. So the client package should not *depend on* `@game-engine/clsc` as a published package. It should bundle the VM in (§4.3).

## 7. Guardrails against shipping licensed art

**What the tools do:**

- **Allowlist.** `files` "specifies which entries get included". `package.json`, README, LICENSE and `main` are always included ([npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)).
- **Ignore files.** "If a `package.json` `files` array is present, any **top-level** `.npmignore` and `.gitignore` files are ignored: the `files` array is the sole source of inclusion at the package root" ([npm-packlist](https://github.com/npm/npm-packlist)).
  - This means the repo's `.gitignore` entry `assets/` does **not** protect a package that has a `files` array. The allowlist has to do it on its own.
  - Without `files`, npm falls back to `.npmignore`, then to `.gitignore` (same source).
- **Symlinks.** npm-packlist follows a symlink's target only for bundled dependencies (same source).
- **Bun.** `bun pm pack` follows "the same rules as `npm pack`", respects `files`/`.npmignore`/`.gitignore`, and has `--dry-run` ([bun pm](https://bun.com/docs/pm/cli/pm)).

**Experiment.** A fixture package had `files: ["dist"]` and contained:

- `dist/index.js` (the bundle);
- `dist/assets` → a symlink to a "licensed" folder;
- `public/assets` → the same symlink;
- a real `assets/secret-map.json`.

Both `bun pm pack --dry-run` (bun 1.4.2) and `npm pack --dry-run` (npm 10.9.8) listed **only `package.json` and `dist/index.js`**. The symlink inside the allowlisted `dist/` was not followed. Other npm/Bun versions are untested.

**The gap.** `files` filters *paths*. It cannot see licensed content a bundler **inlines**: a Tiled `.tmj` imported as JSON, or an image imported through a file loader, ends up as bytes inside `dist/index.js`. Today the engine loads art by URL at runtime, so nothing is inlined, but nothing enforces that either.

**Leaning: guardrails, cheapest first.**

1. **`files: ["dist"]`** in the client package's `package.json`.
2. **A pack check in CI.** Run `npm pack --dry-run --json` (or `bun pm pack --dry-run`) and fail on any path outside `dist/`, or with an art/map extension (`.png`, `.tmj`, `.tsj`, `.json` under `assets`, …).
3. **An input check.** Fail if any bundle input (the `// path` comments in an unminified build, or Bun.build's metafile) is under `assets/` or `apps/`, or anything other than `packages/engine-core/src` and `packages/clsc/vm/src`.
4. **A manifest check.** Fail if the packed `package.json` lists any `@game-engine/*` in `dependencies`/`peerDependencies` (§4.3).

## 8. Open questions this surfaced

- **License.** The repo has no LICENSE. npm will publish without one, but strangers then have no right to use the code. Picking a license is a prerequisite for "installable by strangers". It also matters for the bundled engine-core and VM code.
- **Package name and scope.** Publishing `@x/...` on npm requires owning the npm user or org `x`. GitHub Packages forces `@palmkonde`. Whether `@game-engine` can be registered on npm is unknown: both package names are 404s, and the org page returned 403 to an anonymous check. The name is hard to change once strangers depend on it, so it's ADR material.
- **Release mechanics** (who bumps versions, CI publish, provenance) are untouched here. They can be settled in the build tickets.

## Appendix A: bundle script

`src/index.ts` re-exports `packages/engine-core/src/index.ts` and `packages/clsc/vm/src/program.ts`.

```ts
const r = await Bun.build({
  entrypoints: [import.meta.dir + '/src/index.ts'],
  outdir: import.meta.dir + '/dist',
  format: 'esm',
  target: 'browser',
  external: ['phaser', 'grid-engine', 'react', 'react-dom'],
})
console.log(r.success, r.logs, r.outputs.map(o => [o.path.split('/').pop(), o.size]))
// → true [] [ [ "index.js", 32490 ] ]
```

A second entry beginning with `'use client'` and built the same way produced output starting `// packages/engine-core/src/engine.ts`, so the directive was stripped.

## Appendix B: declaration emit

These are the tsconfig options; `files` lists the same two entries.

```json
{ "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler", "strict": true,
  "skipLibCheck": true, "allowImportingTsExtensions": true,
  "declaration": true, "emitDeclarationOnly": true, "rootDir": "<repo>/packages", "outDir": "types-out" }
```

The consumer check imported `createEngine`/`EngineHandle` from the emitted `index.d.ts`, with `skipLibCheck` off and no `allowImportingTsExtensions`. It ran under `bundler` and under `NodeNext` (`"type": "module"`). The only diagnostics came from `phaser/types/phaser.d.ts` itself.

## Appendix C: pack fixture

```json
{ "name": "@scope/client-exp", "version": "0.0.1", "type": "module", "files": ["dist"],
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "peerDependencies": { "phaser": "~4.0.0" } }
```

Layout: `dist/index.js`, `dist/assets -> ../licensed`, `public/assets -> ../licensed`, `assets/secret-map.json`.

```
$ bun pm pack --dry-run          # bun 1.4.2
packed 228B package.json
packed 32.49KB dist/index.js
Total files: 2

$ npm pack --dry-run             # npm 10.9.8
npm notice 32.5kB dist/index.js
npm notice 228B package.json
npm notice total files: 2
```
