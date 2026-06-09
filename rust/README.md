# dawa-search — Offline Drug Name Fuzzy Search

A Rust crate that provides sub-millisecond offline drug name matching using
Jaro-Winkler similarity. No network required. Ships as:

| Artifact | Platform | Targets |
|---|---|---|
| `libdawa_search.so` | Android | arm64-v8a, armeabi-v7a, x86_64 |
| `libdawa_search.a` | iOS | aarch64-apple-ios + x86_64-apple-ios (universal) |

---

## Building

### Android

```bash
# 1. Install cargo-ndk
cargo install cargo-ndk

# 2. Point to your NDK
export ANDROID_NDK_HOME=/path/to/your/ndk

# 3. Build + copy .so files
cd rust
chmod +x build-android.sh
./build-android.sh
```

The script copies the `.so` files into the correct `jniLibs/` sub-directories
so Gradle picks them up automatically.

### iOS

```bash
# 1. Install cargo-lipo
cargo install cargo-lipo

# 2. Build + copy .a + generate header
cd rust
chmod +x build-ios.sh
./build-ios.sh
```

Then in Xcode:
1. Drag `ios/App/App/RustBridge/libdawa_search.a` into the project navigator
   (check **Add to target: App**).
2. Add the header import to `App-Bridging-Header.h`:
   ```objc
   #import "RustBridge/dawa_search.h"
   ```

---

## Architecture

```
JS / React (TypeScript)
        │
        ▼  Capacitor Bridge
NativeSearchPlugin  (Kotlin / Swift)
        │
        ▼  JNI (Android) / C FFI (iOS)
libdawa_search  (Rust)
        │
        ▼
Jaro-Winkler matching over embedded DRUG_INDEX
```

### Wire format (C FFI / iOS)

`dawa_search_fuzzy` writes null-terminated UTF-8 into the caller's buffer:

```
record₁ \x1E record₂ \x1E …
```

Each record:
```
name \x1F score \x1F rxcui
```

The Android JNI path returns a JSON string instead, since the JVM string
bridge is the natural boundary.

---

## Expanding the drug database

Edit `src/search.rs` — the `DRUG_INDEX` static slice currently holds ~180
entries from the EAC Essential Medicines List and WHO Model List.

For production, replace with a compressed binary index generated from the
full RxNorm RXNCONSO table (~15 000 entries, ~120 KB compressed with zstd):

1. Download RXNCONSO.RRF from the [NLM RxNorm Full Release](https://www.nlm.nih.gov/research/umls/rxnorm/docs/rxnormfiles.html).
2. Filter for `LAT=ENG` and `TTY IN (IN, PIN, BN, SBD, SCD)`.
3. Emit a sorted `&[(&str, &str)]` literal or a `[u8]` blob decoded at startup.

---

## Crate features

| Feature | Effect |
|---|---|
| `android` | Compiles the `jni_bindings` module (JNI exports + `jni` crate) |
| `ios` | No-op — iOS uses the `extern "C"` exports already present in `lib.rs` |

Default build (no features) exposes only the `extern "C"` symbols and the
public Rust API, suitable for testing on the host with `cargo test`.
