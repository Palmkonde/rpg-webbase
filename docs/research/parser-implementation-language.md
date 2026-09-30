# Parser implementation language: TypeScript vs Rust, Go or C

## 1. Question and scope

Ticket [#47](https://github.com/Palmkonde/rpg-webbase/issues/47) (child of map [#39](https://github.com/Palmkonde/rpg-webbase/issues/39)) asks what it costs to build the Script language's parser and interpreter in each candidate language (**TypeScript**, **Rust**, **Go**, **C**), and how each would reach this Next.js app. The language is small and indentation-based, with Thai text inside string literals. The developer's worry is that a TypeScript parser or interpreter would be too slow.

This note gathers facts and one measurement. It does not choose the language. That belongs to the map's decision tickets and an ADR.

The app's actual setup is `apps/web/package.json` with `next ^16.0.0`, installed as **16.3.5**, and `next dev` / `next build` with no `--webpack` flag. `apps/web/next.config.mjs` has only `transpilePackages`, so the app builds with **Turbopack**, the default bundler since Next.js 16 ([Next.js 16 release](https://nextjs.org/blog/next-16); [Turbopack docs](https://nextjs.org/docs/app/api-reference/turbopack)).

## 2. Findings in brief

- **Speed is not a real concern in TypeScript.** On an Apple M2, a hand-written TS tokenizer and recursive-descent parser handles a 5 KB script with Thai text in **about 1 ms cold** (first call in a fresh process) and **about 0.03 ms warm**. With the JIT disabled it takes **about 0.8 ms**. A 60 fps frame lasts 16.7 ms, and parsing runs once when a script loads, not every frame. Walking the whole AST takes 0.004 ms. Dialogue waits on the player, so interpreter speed has nothing to optimise (§3).
- **Compiling the script to JSON at build time does not save runtime.** `JSON.parse` on the equivalent AST (0.032 ms) is *no faster* than parsing the source itself (0.026 ms warm), because the JSON is bigger than the source (7.0 KB vs 5.2 KB) (§3).
- **Indentation belongs in the lexer, and it is about 20 lines in any of the four languages.** Keep a stack of indent widths and emit INDENT/DEDENT tokens. Library support varies: Chevrotain has an official example, pest has stack operators, Ohm's support is *experimental* and spaces-only, and participle says outright that it cannot express it (§4).
- **Thai inside string literals is a non-issue for every candidate, C included.** The real Unicode cost is reporting **columns** in error messages (§5).
- **WASM works with Turbopack, but with friction.** It adds a second toolchain, a copy across the JS↔WASM string boundary, and a **UTF-8 byte offset ↔ UTF-16 offset** mapping that every error location or editor squiggle has to go through. wasm-bindgen's `--target bundler` is documented as fully compatible only with webpack, so the bundler-agnostic route is `--target web`, or a file in `public/` plus `WebAssembly.instantiateStreaming` (§6).

## 3. Speed check

### Method

- The benchmark is a throwaway script, reproduced in full in the [appendix](#appendix-benchmark-script). It has no dependencies.
- It contains a hand-written tokenizer (indent stack → INDENT/DEDENT, string literals with `\"` escapes, identifiers, numbers, operators, `#` comments), a recursive-descent parser for `scene` / `say` / `choice` + options / `set` / `move` / `if … else`, and a tree-walk that stands in for the interpreter.
- The input is synthetic: repeated 14-line scenes nested up to 4 levels deep. Every `say` holds a Thai sentence with tone marks and above/below vowels (U+0E48, U+0E34, …), and one sentence contains an escaped `"`.
- A built-in `assert` checks that every parsed string literal equals its source text exactly.
- Hardware and runtime: Apple M2, Node v22.23.2, which strips the types natively, so `node bench.ts <bytes>` runs it with no flag.
- **Cold** is the first `parse(tokenize(src))` call in a fresh process. That is what a player pays when a script loads. **Warm** is the median of 200 repetitions. The JSON column is `JSON.parse` of `JSON.stringify(ast)`, the floor for a "compile to JSON at build time" pipeline.
- **Jitless** runs the same file after `module.stripTypeScriptTypes` with `node --jitless`. It stands in for a slow device or an engine without JIT. Node's type stripping itself needs WASM, which `--jitless` disables, so the types are stripped first.
- Each size was run 3 times. The table shows representative values; cold 5 KB ranged from 0.93 to 1.21 ms.

### Results

| Script (UTF-8 bytes / lines / tokens / AST nodes) | Cold parse | Warm parse (median) | `JSON.parse` of AST (median) | AST walk (median) | Jitless cold | Jitless warm |
|---|---|---|---|---|---|---|
| **5.2 KB** / 71 / 301 / 60 | **0.95 ms** | 0.026 ms | 0.032 ms (7.0 KB JSON) | 0.004 ms | 0.79 ms | 0.27 ms |
| 51 KB / 687 / 2,941 / 588 | 2.8 ms | 0.17 ms | 0.31 ms | 0.039 ms | 3.3 ms | 2.7 ms |
| 500 KB / 6,707 / 28,741 / 5,748 | 17 ms | 1.8 ms | 3.1 ms | 0.37 ms | 28 ms | 28 ms |

### Reading the numbers

- **Scaling is linear.** Warm time grows about 10× for each 10× in input. The cold 5 KB figure is dominated by one-time compile and warm-up, which is why it is about 40× the warm figure.
- **Against the frame budget:** at 60 fps the budget is 16.7 ms per frame. A 5 KB script costs about 1 ms, once, when it loads. Only a single 500 KB file, roughly 100× every cutscene in `apps/web/src/state/cutscene.ts` (6.2 KB of builder code today), would come near a frame's budget, and it would still be a one-time load hitch.
- **The interpreter is paced by the player.** Between two player inputs it runs a handful of AST nodes, a few microseconds at most, and then waits on the Host (a Dialogue line, a `moveTo`). The table's "AST walk" visits *every* node of the script in 0.004 ms. No per-frame loop executes script code.
- **Pre-compiling to JSON is not a speed win.** The JSON of this AST is larger than the source, and `JSON.parse` takes as long or longer than the hand-written parser. The only reasons for a build-time step are catching errors before runtime and not shipping the parser (a few KB). Both are covered in §6.
- **Caveat:** this parser is a sketch with no error recovery and no source spans on AST nodes. A production parser with spans and friendlier errors will be slower by a constant factor. Against the 16.7 ms frame budget the margin is about 17× cold and about 600× warm, and parsing does not happen every frame anyway.

## 4. Parser approach and indentation (INDENT/DEDENT)

The standard technique is the one Python's tokenizer uses ([Python reference, Indentation](https://docs.python.org/3/reference/lexical_analysis.html#indentation)). At the start of each non-blank line, measure the leading whitespace. If it is deeper than the top of an indent stack, push it and emit INDENT. While it is shallower, pop and emit DEDENT. If it doesn't land on an existing level, that's an error. At end of file, emit the remaining DEDENTs. After that the parser sees ordinary brace-like tokens, so **choosing a parser library barely affects indentation**. In the benchmark it takes about 20 lines of `tokenize`.

| Language | Library | Indentation support (primary source) | Notes |
|---|---|---|---|
| **TS** | hand-written recursive descent | Indent stack in the lexer, as above | No dependency. Best for learning, and gives full control over error messages. |
| TS | **Chevrotain** 13.2.0 | Official `python_indentation` example. A custom function-based token pattern holds an indent stack in a closure; "Outdent must appear before Indent", and "remaining Outdents" are added after `tokenize()` ([example](https://github.com/Chevrotain/chevrotain/blob/master/examples/lexer/python_indentation/python_indentation.js)) | Parser DSL in plain TS, no codegen step. |
| TS | **Ohm** 17.5.0 | "As of v17, Ohm has **experimental** support" via `ExperimentalIndentationSensitive`, outside semver, and "*only* works with spaces (not tabs)" ([Ohm docs](https://ohmjs.org/docs/indentation-sensitive)). Open issues report dedent bugs ([#465](https://github.com/ohmjs/ohm/issues/465), [#467](https://github.com/ohmjs/ohm/issues/467)) | Grammar is a separate language. Has `unicodeChar<"…">` categories ([syntax ref](https://ohmjs.org/docs/syntax-reference)). |
| TS | **Peggy** 5.1.0 | Nothing documented for indentation. You would pre-process to INDENT/DEDENT, or track state in the per-parse initializer plus `&{ }` semantic predicates ([docs](https://peggyjs.org/documentation.html)) | Generates a standalone parser at build time via CLI ("no runtime is required"). Supports `\p{…}` classes and a `u` flag. |
| TS | **Lezer** (`@lezer/lr` 1.4.10) | External tokenizer plus `ContextTracker`, "such as when creating 'indent' and 'dedent' tokens in a Python parser" ([guide](https://lezer.codemirror.net/docs/guide/)) | Built for editors (incremental, error-recovering) and produces a *concrete* syntax tree, "not very abstract". Better suited to later **syntax highlighting** (map #39 "Not yet specified") than to the interpreter's parser. |
| **Rust** | hand-written | Same indent stack | `&str` is UTF-8, so slicing is by byte offset. |
| Rust | **logos** 0.16.1 | No indentation feature. The `Lexer` has an `extras` field for user state, plus `bump`, `remainder`, and `morph` for context switches ([docs.rs](https://docs.rs/logos/latest/logos/struct.Lexer.html)). Emitting INDENT/DEDENT is a post-pass over its tokens | Lexer only; pair it with a hand-written parser or chumsky. |
| Rust | **chumsky** | 0.9.3 shipped `text::semantic_indentation` ([docs.rs 0.9.3](https://docs.rs/chumsky/0.9.3/chumsky/text/fn.semantic_indentation.html)). The 0.13.0 `text` module lists no indentation helper ([docs.rs latest](https://docs.rs/chumsky/latest/chumsky/text/index.html)) | Parser combinators. Known for good error messages. |
| Rust | **pest** | Grammar stack operators: store leading whitespace with `PUSH`, match it with `PEEK_ALL`, leave a block with `DROP`. Official example grammar ([pest book](https://pest.rs/book/grammars/syntax.html)) | PEG grammar in a separate `.pest` file. |
| Rust | **nom** | Nothing built in; write it by hand with combinators | Byte/str combinators. |
| **Go** | hand-written | Same indent stack. The Go standard library's own `go/scanner` + `go/parser` are hand-written | `string` is UTF-8 bytes, and `unicode/utf8` is in the standard library. |
| Go | **participle** | "Notably, indentation based lexers **cannot** be expressed using the `stateful` lexer". A custom `lexer.Definition` is needed ([README](https://github.com/alecthomas/participle)) | Grammar comes from struct tags. |
| **C** | hand-written (no library named in the ticket) | Same indent stack | You manage memory for tokens, AST and strings yourself. |

**What this means:** for a small language, a hand-written tokenizer plus recursive descent is roughly the same amount of code in all four languages. It is also the approach that teaches the most, which is the map's stated goal. Libraries mainly save work in the *parser*, and they cost you control over error messages, which are the one thing the ADR-0029 decision said we now own.

## 5. Thai and other Unicode in string literals

- **Thai sits in the Basic Multilingual Plane** (U+0E00–U+0E7F, [Unicode chart](https://www.unicode.org/charts/PDF/U0E00.pdf)). In JS/TS each Thai character is one UTF-16 code unit, with no surrogate pairs. In UTF-8 (Rust, Go, C) each one is 3 bytes. In the benchmark, 5,177 UTF-8 bytes were 2,563 UTF-16 units.
- **A byte-oriented lexer can't be tricked by Thai.** In UTF-8, octets below 0x80 never appear inside a multi-byte sequence ([RFC 3629 §3](https://www.rfc-editor.org/rfc/rfc3629#section-3)), so a `"`, `\` or newline byte is always the real ASCII character. A C lexer that scans bytes until the closing `"` and copies what's between them handles Thai correctly without decoding anything. The same holds in Rust, Go and TS.
- **The real cost is columns in error messages.** Thai stacks combining marks (tone marks, above/below vowels) on a base consonant. `ป่า` ("forest") is **9** UTF-8 bytes, **3** UTF-16 code units (the same as its 3 code points, because Thai is in the BMP), and **2** grapheme clusters, which is what a designer counts as characters (measured with `Buffer.byteLength`, `.length` and `Intl.Segmenter('th')`). An error at "column 12" has to choose one:
  - TS gives code-unit offsets for free.
  - Rust, Go and C give byte offsets, about 3× the UTF-16 offset on Thai text.
  - Grapheme columns need `Intl.Segmenter` in JS ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)), or a crate or package in Rust or Go.

  Indentation itself is ASCII spaces, so INDENT/DEDENT logic is not affected.
- **Identifiers:** if keywords and names stay ASCII (as in the benchmark), no Unicode tables are needed. If Thai *identifiers* are wanted, use `\p{L}`/`\p{M}` classes (JS regex `u` flag, Peggy `\p{}`, Ohm `unicodeChar`) or `char::is_alphanumeric` in Rust. In C you would need your own tables.

## 6. How each option reaches the app

### A. TypeScript, parsed at runtime inside the bundle

- It is a workspace package like `engine-core`, added to `transpilePackages`. There is no new toolchain, and `node --test` works as it does today.
- Script files can be imported as strings: Turbopack 16.2+ has `turbopack.rules['*.ext'] = { type: 'raw' }` ("Return raw contents as string"), or the per-import `with { turbopackLoader: 'raw-loader', turbopackAs: '*.js' }` ([turbopack config](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack)). They can also be fetched from `public/`.
- Cost in the bundle: a hand-written parser plus interpreter is a few KB. For libraries, npm `unpackedSize` is **not** bundle size (Chevrotain 1.24 MB, Ohm 2.15 MB, Peggy 0.59 MB, @lezer/lr 0.17 MB unpacked). Measure the real contribution with `next build` if a library is picked.
- Error offsets are native JS string offsets, so they map straight onto the source for overlays and editor tooling.

### B. Rust, Go or C compiled to WASM and loaded by the app

**Next 16.3.5 on Turbopack:**
- A `webpack()` function in `next.config` "is not recognized" under Turbopack ([Turbopack docs](https://nextjs.org/docs/app/api-reference/turbopack)), so the classic webpack recipe `experiments.asyncWebAssembly` ([webpack experiments](https://webpack.js.org/configuration/experiments/)) is out unless the app moves back to `--webpack`.
- Turbopack 16.2+ does list a `wasm` module type ("Process as WebAssembly") for `turbopack.rules` ([turbopack config](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack)). Its import semantics are not documented further on that page.
- The **bundler-agnostic** path is to put the `.wasm` in `public/` and load it with `WebAssembly.instantiateStreaming(fetch('/parser.wasm'), imports)`. MDN calls it "the most efficient, optimized way to load Wasm code". It requires the `application/wasm` MIME type, or the promise rejects ([MDN](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static)).
- **Unverified:** whether Turbopack resolves the `new URL('x_bg.wasm', import.meta.url)` pattern that wasm-bindgen's web output uses by default. It was not tested here.

**Every WASM option adds these costs:**
- **Strings are copied across the boundary.** wasm-bindgen "uses the `TextEncoder` API to convert from UTF-16 to UTF-8", and unpaired surrogates become U+FFFD ([wasm-bindgen `str`](https://wasm-bindgen.github.io/wasm-bindgen/reference/types/str.html)). With emscripten you allocate with `stringToNewUTF8` and must `free(ptr)` afterwards ([emscripten interacting with code](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html)).
- **Offsets come back as UTF-8 bytes.** Every error location, and any future editor squiggle, has to be mapped from byte offset to UTF-16 offset before it lines up with the JS string. That tooling is still open on map #39 ("Editor support").
- **The AST has to come back to JS, or the interpreter has to live in WASM.** If the AST is serialised (for example as a JSON string), §3 shows `JSON.parse` alone costs as much as the whole TS parse. If the interpreter stays in WASM, every Host call (a Dialogue line, `moveTo`, a Flag read) crosses back into TS/Phaser.
- There is an async instantiate step before the first Script can run.

**Per-language toolchain:**

| | Toolchain (status) | Build / JS glue | Size |
|---|---|---|---|
| **Rust** | `wasm-bindgen` 0.2.129 plus `wasm-pack`. The old `rustwasm` GitHub org was sunset in July 2025: wasm-bindgen moved to a new `wasm-bindgen` org, and the other repos were "archived or transferred" ([Rust blog](https://blog.rust-lang.org/inside-rust/2025/07/21/sunsetting-the-rustwasm-github-org/)). `wasm-pack` is now maintained at [`wasm-bindgen/wasm-pack`](https://github.com/wasm-bindgen/wasm-pack) (v0.15.0, 2026-05-15, per GitHub API). | `--target bundler` assumes the WASM module is an ES module, and "Currently the only known bundler known to be fully compatible with `wasm-bindgen` is webpack". `--target web` "can natively be included on a web page" as an ES module and needs no bundler ([wasm-bindgen deployment](https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html)). | **Not measured** (no Rust toolchain on this machine). To measure: `wasm-pack build --release --target web`, then check `pkg/*_bg.wasm` raw and gzipped. |
| **Go** (standard compiler) | `GOOS=js GOARCH=wasm go build`, plus `$(go env GOROOT)/lib/wasm/wasm_exec.js`, which must match the compiler's major version ([Go wiki](https://go.dev/wiki/WebAssembly)) | `wasm_exec.js` glue, and `syscall/js` for interop | Go wiki: "the smallest possible size being around **~2MB**", "10MB+ is common" with libraries, about 500 kB after compression. |
| **Go** (TinyGo v0.42.0, 2026-09-01) | `GOOS=js GOARCH=wasm tinygo build`. Uses **TinyGo's own** `wasm_exec.js`, which must match the TinyGo version. Functions are exported with `//export` ([TinyGo guide](https://tinygo.org/docs/guides/webassembly/wasm/)) | Size flags: `-no-debug`, `-opt=z` | Go wiki gives about 10 kB for a minimal TinyGo program. The parser is **not measured** here. TinyGo supports "a subset of the Go language". |
| **C** | emscripten (`emcc`). `-sMODULARIZE` wraps the output "in an async function", and `-sEXPORT_ES6` gives an ES module (implies MODULARIZE). `-sENVIRONMENT=web`. `-sSTANDALONE_WASM` emits WASM that "can run without JavaScript" ([settings reference](https://emscripten.org/docs/tools_reference/settings_reference.html)) | `-sEXPORTED_FUNCTIONS=_fn` and `-sEXPORTED_RUNTIME_METHODS=ccall,cwrap`. The `ccall`/`cwrap` `'string'` type converts UTF-8 for you ([interacting with code](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html)) | **Not measured.** The FAQ recommends `-Os`/`-O3`, Closure and gzip for size ([FAQ](https://emscripten.org/docs/getting_started/FAQ.html)). |

Dev setup cost: this repo's machine currently has none of `cargo`, `go`, `tinygo`, `emcc` or `wasm-pack` installed. Every contributor and every CI run would need that toolchain in addition to Node, although the repo's `flake.nix` could pin it.

### C. Build-time compiler that outputs JSON, played by a small TS runtime

- **A Rust, Go or C compiler** runs as a native binary through a `predev`/`prebuild` npm script, or through a JS webpack-style loader that spawns it.
  - Turbopack loaders "that return JavaScript code are supported" (`as: '*.js'`), `emitFile` is not supported, and `fs` supports only `readFile` ([turbopack config](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack)). A loader would therefore have to return the JSON as a JS module.
  - A plain `prebuild` script loses hot reload unless you add a file watcher. Hot reload is an open item on map #39.
  - Whether a loader that spawns a child process works cleanly under Turbopack was **not verified**.
- **A TS compiler** can run in the same loader in-process, or just parse at runtime (path A). §3 shows the runtime parse is as cheap as loading the pre-compiled JSON.
- **What this path does buy** is script errors that fail `next build` or CI instead of showing up when the script is first played. A TS parser gets the same thing from a `node --test` or CI check that parses every script file, and still parses at runtime.
- **What it costs:** the runtime still needs a TS interpreter over the JSON AST. So "Rust compiler + TS runtime" means the AST types are defined **twice**, in two languages, and must be kept in sync.

## 7. Trade-off summary

| | TS (runtime parse) | Rust → WASM | Go → WASM | C → WASM | Native compiler → JSON + TS runtime |
|---|---|---|---|---|---|
| Parse speed for this workload | ~1 ms cold per 5 KB (§3), which is enough | Faster in principle; unmeasured; overhead of boundary copy and AST transfer | Same as Rust, plus Go's runtime | Same as Rust | None at runtime (`JSON.parse` ≈ TS parse) |
| New toolchain | none | cargo + wasm-bindgen/wasm-pack | go or tinygo + matching `wasm_exec.js` | emscripten | cargo/go/cc + a loader or prebuild script |
| Fits Turbopack (Next 16.3.5) | natively | `--target web` / `public/` + fetch; `bundler` target is webpack-only | `public/` + fetch + `wasm_exec.js` | ES6-modularized output or `public/` + fetch | loader returns JS; `emitFile` unsupported |
| Error offsets ↔ JS source | native UTF-16 | UTF-8 bytes → need mapping | UTF-8 bytes → need mapping | UTF-8 bytes → need mapping | UTF-8 bytes → need mapping |
| AST defined in | one place | Rust (+ JS-side shape if returned) | Go (+ JS side) | C (+ JS side) | two languages |
| Indentation | ~20-line lexer pass; Chevrotain example | ~same; pest `PUSH`/`PEEK_ALL`/`DROP` | ~same; participle can't | ~same | ~same |
| Thai in strings | free | free (copied via `TextEncoder`) | free | free (byte scan) | free |

## 8. What this means for the decision

This is input for the decision, not a recommendation.

- **Performance is not a reason to leave TypeScript.** The measured cost is about 1 ms once per script load, against a 16.7 ms frame, and the interpreter runs at the player's pace.
- **The deciding factors are elsewhere:**
  - how much toolchain and boundary plumbing is acceptable: a second compiler, WASM loading under Turbopack, string copies, and UTF-8 ↔ UTF-16 offset mapping for errors and future editor support;
  - where the AST types live: one language or two;
  - the learning goal. Recursive descent teaches the same things in any of the four languages. Rust, Go or C adds WASM/FFI lessons on top, which is a separate subject from language implementation.
- If the learning goal points at Rust, Go or C, the path with the least friction is probably **a native build-time checker/compiler for CI and editor tooling, while the runtime parses in TS**. The trade-off is that the parser exists twice. §6 C already covers this; weigh it in the decision ticket.

## 9. Not verified here

- **WASM sizes** for Rust, TinyGo and emscripten builds of a parser like this one. No toolchains are installed. The commands to measure them are in §6.
- **Turbopack behaviour** with wasm-bindgen's `new URL(…, import.meta.url)` output, the precise semantics of the `wasm` module type, and loaders that spawn child processes.
- **Real devices.** Parse time was not measured on a low-end phone. `--jitless` is a proxy for that.

## Sources

- Next.js: [Next.js 16 release](https://nextjs.org/blog/next-16) · [Turbopack](https://nextjs.org/docs/app/api-reference/turbopack) · [`turbopack` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack) (docs version 16.3.7)
- webpack: [experiments (`asyncWebAssembly`)](https://webpack.js.org/configuration/experiments/)
- MDN: [`WebAssembly.instantiateStreaming`](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static) · [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)
- Rust/WASM: [wasm-bindgen deployment targets](https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html) · [wasm-bindgen `str`](https://wasm-bindgen.github.io/wasm-bindgen/reference/types/str.html) · [Sunsetting the rustwasm org](https://blog.rust-lang.org/inside-rust/2025/07/21/sunsetting-the-rustwasm-github-org/) · [wasm-bindgen/wasm-pack repo](https://github.com/wasm-bindgen/wasm-pack) (latest release via GitHub API)
- Go: [Go wiki: WebAssembly](https://go.dev/wiki/WebAssembly) · [TinyGo WebAssembly guide](https://tinygo.org/docs/guides/webassembly/wasm/) · [participle README](https://github.com/alecthomas/participle)
- C: [emscripten settings reference](https://emscripten.org/docs/tools_reference/settings_reference.html) · [Interacting with code](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html) · [FAQ](https://emscripten.org/docs/getting_started/FAQ.html)
- TS parser libraries: [Chevrotain python_indentation example](https://github.com/Chevrotain/chevrotain/blob/master/examples/lexer/python_indentation/python_indentation.js) · [Ohm indentation-sensitive](https://ohmjs.org/docs/indentation-sensitive) · [Ohm syntax reference](https://ohmjs.org/docs/syntax-reference) · [Peggy docs](https://peggyjs.org/documentation.html) · [Lezer guide](https://lezer.codemirror.net/docs/guide/). Versions are from `npm view` on 2026-09-30.
- Rust parser libraries: [logos `Lexer`](https://docs.rs/logos/latest/logos/struct.Lexer.html) · [chumsky 0.9.3 `semantic_indentation`](https://docs.rs/chumsky/0.9.3/chumsky/text/fn.semantic_indentation.html) · [chumsky latest `text`](https://docs.rs/chumsky/latest/chumsky/text/index.html) · [pest book: syntax / stack](https://pest.rs/book/grammars/syntax.html)
- Python: [Lexical analysis, Indentation](https://docs.python.org/3/reference/lexical_analysis.html#indentation)
- Unicode: [Thai code chart U+0E00–U+0E7F](https://www.unicode.org/charts/PDF/U0E00.pdf) · [RFC 3629 (UTF-8) §3](https://www.rfc-editor.org/rfc/rfc3629#section-3)

## Appendix: benchmark script

Save it as `bench.ts` and run `node bench.ts 5000` (or `50000`, `500000`) on Node ≥ 22.18. For the jitless run, strip the types first, then run `node --jitless bench.mjs 5000`:

```
node -e "const m=require('node:module'),fs=require('fs');fs.writeFileSync('bench.mjs',m.stripTypeScriptTypes(fs.readFileSync('bench.ts','utf8')))"
```

It is kept here, not as a `.ts` file in the repo, so the strict oxlint config doesn't lint throwaway code.

```ts
// Throwaway benchmark for docs/research/parser-implementation-language.md.
// Hand-written tokenizer (INDENT/DEDENT via an indent stack) + recursive-descent parser
// + a tree-walking "interpreter" pass, over a synthetic indentation-based script with Thai strings.
// Run: node bench.ts [targetBytes]   (Node >= 22.18 strips the types; no deps)
import assert from 'node:assert/strict'

type Tok = { k: string; v: string; line: number; col: number }

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  const indents = [0]
  let i = 0
  let line = 1
  let lineStart = 0
  let atLineStart = true
  const n = src.length
  const push = (k: string, v: string, at: number) => out.push({ k, v, line, col: at - lineStart + 1 })
  while (i < n) {
    if (atLineStart) {
      let w = 0
      while (i < n && src.charCodeAt(i) === 32) { w++; i++ }
      const c = src.charCodeAt(i)
      if (i >= n || c === 10 || c === 35) { // blank or comment-only line: no indentation change
        while (i < n && src.charCodeAt(i) !== 10) i++
        if (i < n) { i++; line++; lineStart = i }
        continue
      }
      atLineStart = false
      if (w > indents[indents.length - 1]) { indents.push(w); push('INDENT', '', i) }
      while (w < indents[indents.length - 1]) { indents.pop(); push('DEDENT', '', i) }
      if (w !== indents[indents.length - 1]) throw new Error(`${line}: inconsistent dedent`)
    }
    const c = src.charCodeAt(i)
    if (c === 10) { push('NL', '', i); i++; line++; lineStart = i; atLineStart = true; continue }
    if (c === 32) { i++; continue }
    if (c === 35) { while (i < n && src.charCodeAt(i) !== 10) i++; continue }
    if (c === 34) { // string literal: any UTF-16 code unit except " \ newline; Thai passes straight through
      const start = i++
      let s = ''
      let from = i
      while (i < n && src.charCodeAt(i) !== 34) {
        const d = src.charCodeAt(i)
        if (d === 10) throw new Error(`${line}: unterminated string`)
        if (d === 92) { s += src.slice(from, i) + src[i + 1]; i += 2; from = i; continue }
        i++
      }
      s += src.slice(from, i)
      i++
      push('STR', s, start)
      continue
    }
    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95) {
      const start = i
      while (i < n) {
        const d = src.charCodeAt(i)
        if ((d >= 97 && d <= 122) || (d >= 65 && d <= 90) || (d >= 48 && d <= 57) || d === 95 || d === 46) i++
        else break
      }
      push('ID', src.slice(start, i), start)
      continue
    }
    if (c >= 48 && c <= 57) {
      const start = i
      while (i < n && src.charCodeAt(i) >= 48 && src.charCodeAt(i) <= 57) i++
      push('NUM', src.slice(start, i), start)
      continue
    }
    const two = src.slice(i, i + 2)
    if (two === '==' || two === '!=' || two === '>=' || two === '<=') { push('OP', two, i); i += 2; continue }
    if ('=<>+-'.includes(src[i])) { push('OP', src[i], i); i++; continue }
    throw new Error(`${line}:${i - lineStart + 1}: unexpected ${JSON.stringify(src[i])}`)
  }
  if (out.at(-1)?.k !== 'NL') push('NL', '', i)
  while (indents.length > 1) { indents.pop(); push('DEDENT', '', i) }
  push('EOF', '', i)
  return out
}

type Node = { t: string; [key: string]: unknown }

function parse(toks: Tok[]): Node[] {
  let p = 0
  const peek = () => toks[p]
  const eat = (k: string, v?: string) => {
    const t = toks[p]
    if (t.k !== k || (v !== undefined && t.v !== v)) throw new Error(`${t.line}:${t.col}: expected ${v ?? k}, got ${t.v || t.k}`)
    p++
    return t
  }
  const block = (): Node[] => { eat('NL'); eat('INDENT'); const body = stmts('DEDENT'); eat('DEDENT'); return body }
  const expr = (): Node => {
    const left: Node = peek().k === 'NUM' ? { t: 'num', v: Number(eat('NUM').v) } : { t: 'ref', name: eat('ID').v }
    if (peek().k !== 'OP') return left
    const op = eat('OP').v
    return { t: 'bin', op, left, right: expr() }
  }
  const stmt = (): Node => {
    const t = peek()
    if (t.k === 'STR') { const text = eat('STR').v; return { t: 'option', text, body: block() } }
    const kw = eat('ID').v
    switch (kw) {
      case 'scene': { const name = eat('ID').v; return { t: 'scene', name, body: block() } }
      case 'say': { const who = eat('ID').v; const text = eat('STR').v; eat('NL'); return { t: 'say', who, text } }
      case 'choice': return { t: 'choice', options: block() }
      case 'set': { const name = eat('ID').v; eat('OP', '='); const value = expr(); eat('NL'); return { t: 'set', name, value } }
      case 'move': { const who = eat('ID').v; const x = Number(eat('NUM').v); const y = Number(eat('NUM').v); eat('NL'); return { t: 'move', who, x, y } }
      case 'if': {
        const cond = expr()
        const then = block()
        const other = peek().k === 'ID' && peek().v === 'else' ? (eat('ID'), block()) : []
        return { t: 'if', cond, then, other }
      }
      default: throw new Error(`${t.line}:${t.col}: unknown statement ${kw}`)
    }
  }
  const stmts = (end: string): Node[] => { const list: Node[] = []; while (peek().k !== end) list.push(stmt()); return list }
  return stmts('EOF')
}

// Stand-in for the interpreter: visit every node once (a real one is paced by the player, not the CPU).
function walk(nodes: Node[]): number {
  let count = 0
  for (const node of nodes) {
    count++
    for (const key of ['body', 'options', 'then', 'other']) if (Array.isArray(node[key])) count += walk(node[key] as Node[])
  }
  return count
}

const LINES = [
  'สวัสดีครับ ท่านผู้กล้า! ค่ำคืนนี้หนาวเหน็บเหลือเกิน',
  'ข้าได้ยินเสียงหมาป่าหอนมาจากป่าทางทิศเหนือ... "อย่าไปคนเดียวนะ"',
  'ถ้าเจ้าช่วยข้าเก็บฟืน ข้าจะเล่าเรื่องปราสาทร้างให้ฟัง',
  'ขอบใจมาก! เอ้า นั่งลงข้างกองไฟก่อนสิ',
]
function scene(k: number): string {
  const esc = (s: string) => s.replaceAll('"', '\\"')
  return [
    `# scene ${k}`,
    `scene camp_${k}`,
    `  say guard "${esc(LINES[k % 4])}"`,
    `  choice`,
    `    "ช่วยเก็บฟืน (${k})"`,
    `      set wood_${k} = wood_${k} + 1`,
    `      say player "${esc(LINES[(k + 1) % 4])}"`,
    `      if wood_${k} >= 3`,
    `        move guard ${k % 20} 4`,
    `        say guard "${esc(LINES[(k + 2) % 4])}"`,
    `      else`,
    `        say guard "${esc(LINES[(k + 3) % 4])}"`,
    `    "ไม่ล่ะ ขอบคุณ"`,
    `      say player "${esc(LINES[(k + 2) % 4])}"`,
    '',
  ].join('\n')
}
function script(targetBytes: number): string {
  let s = ''
  for (let k = 0; Buffer.byteLength(s) < targetBytes; k++) s += scene(k)
  return s
}

const ms = (f: () => void) => { const t = performance.now(); f(); return performance.now() - t }
const median = (xs: number[]) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)]

const target = Number(process.argv[2] ?? 5000)
const src = script(target)

// Cold: the very first call in a fresh process (no JIT warmup) — what a player actually pays on load.
let ast: Node[] = []
const cold = ms(() => { ast = parse(tokenize(src)) })

// Self-check: every string literal round-trips byte-for-byte, Thai combining marks included.
const says: string[] = []
const collect = (ns: Node[]) => { for (const x of ns) { if (x.t === 'say') says.push(x.text as string); for (const key of ['body', 'options', 'then', 'other']) if (Array.isArray(x[key])) collect(x[key] as Node[]) } }
collect(ast)
assert.ok(says.length > 0)
for (const s of says) assert.ok(LINES.includes(s), `string literal mangled: ${s}`)
assert.ok(src.includes('่') && src.includes('ิ'), 'fixture must contain Thai tone marks/vowels')

const json = JSON.stringify(ast)
const warmParse: number[] = []
const warmJson: number[] = []
const warmWalk: number[] = []
for (let r = 0; r < 200; r++) {
  warmParse.push(ms(() => parse(tokenize(src))))
  warmJson.push(ms(() => JSON.parse(json)))
  warmWalk.push(ms(() => walk(ast)))
}
console.log(JSON.stringify({
  sourceBytesUtf8: Buffer.byteLength(src),
  sourceUtf16Units: src.length,
  lines: src.split('\n').length,
  tokens: tokenize(src).length,
  astNodes: walk(ast),
  astJsonBytes: Buffer.byteLength(json),
  coldParseMs: +cold.toFixed(3),
  warmParseMedianMs: +median(warmParse).toFixed(4),
  warmJsonParseMedianMs: +median(warmJson).toFixed(4),
  warmWalkMedianMs: +median(warmWalk).toFixed(4),
}))
```
