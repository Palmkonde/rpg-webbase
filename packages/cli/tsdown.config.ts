import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: 'esm',
  platform: 'node',

  // The package is ESM, so `.js` is enough and `bin` can name `dist/cli.js`.
  outExtensions: () => ({ js: '.js' }),

  // The compiler runs as WASM next to the bundle, so an Author needs no Rust or Nix (adr/0041).
  // Their notices ship with it, since pest and serde_json are compiled into it (adr/0041, adr/0043).
  copy: [
    { from: '../clsc/compiler/target/wasm32-unknown-unknown/release/clsc.wasm', to: 'dist' },
    { from: 'notices/*', to: 'dist' },
  ],
})
