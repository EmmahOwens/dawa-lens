#!/usr/bin/env bash
# Compiles the dawa-search Rust crate to WebAssembly (wasm32-unknown-unknown)
# and copies the resulting .wasm binary to public/wasm/dawa_search.wasm for
# offline Web, PWA, and Android WebView execution.
set -euo pipefail

echo "==> Building dawa-search for WebAssembly (wasm32-unknown-unknown)..."
rustup target add wasm32-unknown-unknown 2>/dev/null || true

cargo build --target wasm32-unknown-unknown --release

mkdir -p ../public/wasm
cp target/wasm32-unknown-unknown/release/dawa_search.wasm ../public/wasm/dawa_search.wasm

echo "==> Done. Copied to ../public/wasm/dawa_search.wasm"
