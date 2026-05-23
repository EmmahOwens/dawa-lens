#!/usr/bin/env bash
# Compiles the dawa-search Rust crate for Android ABI targets and copies the
# resulting .so files to the correct jniLibs directories.
#
# Prerequisites:
#   cargo install cargo-ndk
#   export ANDROID_NDK_HOME=/path/to/your/ndk
#
# Usage (from the rust/ directory):
#   chmod +x build-android.sh
#   ./build-android.sh
set -euo pipefail

echo "==> Building dawa-search for Android..."

# Add target triples (idempotent)
rustup target add \
    aarch64-linux-android \
    armv7-linux-androideabi \
    x86_64-linux-android \
    2>/dev/null || true

# Compile for all three ABIs with the android feature (enables JNI bindings).
cargo ndk \
    -t aarch64-linux-android \
    -t armv7-linux-androideabi \
    -t x86_64-linux-android \
    -P 24 \
    -- build --release --features android

# Copy .so files to the Android jniLibs directory
ANDROID_JNILIBS="../../android/app/src/main/jniLibs"
mkdir -p \
    "$ANDROID_JNILIBS/arm64-v8a" \
    "$ANDROID_JNILIBS/armeabi-v7a" \
    "$ANDROID_JNILIBS/x86_64"

cp target/aarch64-linux-android/release/libdawa_search.so   "$ANDROID_JNILIBS/arm64-v8a/"
cp target/armv7-linux-androideabi/release/libdawa_search.so "$ANDROID_JNILIBS/armeabi-v7a/"
cp target/x86_64-linux-android/release/libdawa_search.so    "$ANDROID_JNILIBS/x86_64/"

echo "==> Done. .so files copied to $ANDROID_JNILIBS"
