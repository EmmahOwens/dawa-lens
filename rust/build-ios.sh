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

DEST="../../ios/App/App/RustBridge"
mkdir -p "$DEST"
cp target/universal/release/libdawa_search.a "$DEST/"

# Generate the C bridging header only if it does not already exist.
if [ ! -f "$DEST/dawa_search.h" ]; then
cat > "$DEST/dawa_search.h" << 'HEADER'
#ifndef DAWA_SEARCH_H
#define DAWA_SEARCH_H
#include <stdint.h>
#include <stddef.h>

/**
 * Returns 1 to confirm the Rust library is linked and functional.
 */
int32_t dawa_search_is_available(void);

/**
 * Fuzzy-searches the embedded drug index.
 *
 * @param query_ptr  Pointer to UTF-8 query bytes (not null-terminated).
 * @param query_len  Byte length of the query.
 * @param limit      Maximum number of results to return (clamped to 1–20).
 * @param out_buf    Output buffer to receive null-terminated UTF-8 results.
 * @param out_buf_len Size of out_buf in bytes (must be >= 1).
 *
 * Output format: records separated by ASCII RS (0x1E), fields by ASCII US (0x1F).
 * Each record: "name\x1Fscore\x1Frxcui"
 *
 * @returns Number of results written (>= 0), or -1 on error.
 */
int32_t dawa_search_fuzzy(
    const uint8_t *query_ptr,
    size_t         query_len,
    int32_t        limit,
    uint8_t       *out_buf,
    size_t         out_buf_len
);

#endif /* DAWA_SEARCH_H */
HEADER
echo "==> Generated $DEST/dawa_search.h"
fi

echo "==> Done. Static library + header at $DEST"
