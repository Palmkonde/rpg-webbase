{
  description = "Dev shell: Bun (docs/adr/0033), git/gh, the clsc Rust toolchain (docs/adr/0031) with lld for its WASM build (docs/adr/0041) and imagemagick for sprite sheets (docs/adr/0006)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.imagemagick
            pkgs.cargo
            pkgs.rustc
            pkgs.clippy
            pkgs.rustfmt
            pkgs.lld
            pkgs.rust-analyzer
            pkgs.git
            pkgs.gh
            pkgs.bun
            pkgs.python315
          ];
          RUST_SRC_PATH = "${pkgs.rustPlatform.rustLibSrc}";

          # nixpkgs' rustc ships no rust-lld, which the wasm32 build of clsc links with (docs/adr/0041).
          CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_LINKER = "wasm-ld";
        };
      });
}
