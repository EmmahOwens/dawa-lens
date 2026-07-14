#!/usr/bin/env bash
# Compiles the dawa-search Rust crate as a universal static library for iOS
# and generates the C bridging header.
#
# Prerequisites:
#   cargo install cargo-lipo
#   Xcode command-line tools installed
#
# Usage (from the rust/ directory):
#   chmod +x build-ios.sh
#   ./build-ios.sh
#
# After running:
#   1. Add ios/App/App/RustBridge/libdawa_search.a to your Xcode project
#      (drag into the project navigator → Add to target "App")
#   2. Import the header in App-Bridging-Header.h:
#        #import "RustBridge/dawa_search.h"
set -euo pipefail

echo "==> Building dawa-search for iOS..."

rustup target add aarch64-apple-ios x86_64-apple-ios 2>/dev/null || true

cargo lipo --release

DEST="../ios/App/App/RustBridge"
mkdir -p "$DEST"
cp target/universal/release/libdawa_search.a "$DEST/"

# Generate the C bridging header
cat > "$DEST/dawa_search.h" << 'HEADER'
#ifndef DAWA_SEARCH_H
#define DAWA_SEARCH_H
#include <stdint.h>
#include <stddef.h>

/**
 * Returns 1 to confirm the Rust library is linked and functional.
 */
int32_t dawa_core_is_available(void);
int32_t dawa_search_is_available(void);

/**
 * Fuzzy-searches the embedded drug index.
 */
int32_t dawa_search_fuzzy(
    const uint8_t *query_ptr,
    size_t         query_len,
    int32_t        limit,
    uint8_t       *out_buf,
    size_t         out_buf_len
);

/**
 * Database Functions
 */
int32_t dawa_db_initialize(const uint8_t *path_ptr, size_t path_len);
int32_t dawa_db_execute(
    const uint8_t *sql_ptr, size_t sql_len,
    const uint8_t *params_ptr, size_t params_len,
    uint8_t *out_buf, size_t out_buf_len
);
int32_t dawa_db_query(
    const uint8_t *sql_ptr, size_t sql_len,
    const uint8_t *params_ptr, size_t params_len,
    uint8_t *out_buf, size_t out_buf_len
);
int32_t dawa_db_close(void);

#endif /* DAWA_SEARCH_H */
HEADER
echo "==> Generated $DEST/dawa_search.h"

echo "==> Done. Static library + header at $DEST"
