# CodeLeagues Script for VS Code

Syntax highlighting for `.clsc` files: a TextMate grammar plus comment/bracket config. No language server — compile errors still come from `clsc build` (see `docs/guides/codeleagues-script.md`).

## Install

Symlink it into VS Code's extensions folder once, from the repo root, then run `Developer: Reload Window`:

```sh
ln -s "$PWD/packages/clsc/vscode" ~/.vscode/extensions/local.clsc-0.0.1
```

Every window then highlights `.clsc`. Grammar edits apply on the next reload, since the folder is linked, not copied. To try a change without touching your main window, press F5 (`Run clsc extension`) instead: a second window opens on `assets/worlds` (your local content folder) with the working copy loaded.

## Keep the keywords in sync

`syntaxes/clsc.tmLanguage.json` repeats the keyword list from `../compiler/src/clsc.pest`. `compiler/tests/vscode_grammar_sync.rs` fails `bun run test` when a pest keyword is missing from the grammar.
