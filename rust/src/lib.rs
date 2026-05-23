mod search;

pub use search::{fuzzy_search, DrugEntry};

/// Returns 1 — confirms the native library loaded and is functional.
#[no_mangle]
pub extern "C" fn dawa_search_is_available() -> i32 {
    1
}

/// Fuzzy-searches the embedded drug index.
///
/// Fills `out_buf` with null-terminated UTF-8 text encoded as:
///   record₁ \x1E record₂ \x1E …
/// where each record is:
///   name \x1F score \x1F rxcui
///
/// `limit` is clamped to 1–20. Returns the number of results written, or -1 on error.
#[no_mangle]
pub extern "C" fn dawa_search_fuzzy(
    query_ptr: *const u8,
    query_len: usize,
    limit: i32,
    out_buf: *mut u8,
    out_buf_len: usize,
) -> i32 {
    if query_ptr.is_null() || out_buf.is_null() || out_buf_len == 0 {
        return -1;
    }

    let query = unsafe {
        match std::str::from_utf8(std::slice::from_raw_parts(query_ptr, query_len)) {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let results = fuzzy_search(query, limit.max(1) as usize);

    // Encode: records separated by ASCII RS (0x1E), fields by ASCII US (0x1F).
    let encoded: String = results
        .iter()
        .map(|e| {
            format!(
                "{}\x1f{:.4}\x1f{}",
                e.name,
                e.score,
                e.rxcui.as_deref().unwrap_or("")
            )
        })
        .collect::<Vec<_>>()
        .join("\x1e");

    let bytes = encoded.as_bytes();
    // Leave room for the null terminator
    let to_copy = bytes.len().min(out_buf_len - 1);
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), out_buf, to_copy);
        *out_buf.add(to_copy) = 0; // null-terminate
    }
    results.len() as i32
}

// ── JNI bindings (Android only) ──────────────────────────────────────────────
#[cfg(feature = "android")]
mod jni_bindings {
    use jni::JNIEnv;
    use jni::objects::{JClass, JString};
    use jni::sys::{jint, jstring};
    use crate::search::fuzzy_search;

    /// Called by NativeSearchPlugin.kt: nativeFuzzySearch(query, limit)
    /// Returns a JSON array string: [{"name":"…","score":0.9876,"rxcui":"…"},…]
    #[no_mangle]
    pub extern "C" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeFuzzySearch(
        mut env: JNIEnv,
        _class: JClass,
        query: JString,
        limit: jint,
    ) -> jstring {
        let q: String = env.get_string(&query).map(Into::into).unwrap_or_default();
        let results = fuzzy_search(&q, limit.max(1) as usize);
        let json = results
            .iter()
            .map(|e| {
                format!(
                    "{{\"name\":\"{}\",\"score\":{:.4},\"rxcui\":\"{}\"}}",
                    e.name.replace('"', "\\\""),
                    e.score,
                    e.rxcui.as_deref().unwrap_or("")
                )
            })
            .collect::<Vec<_>>()
            .join(",");
        let output = format!("[{}]", json);
        env.new_string(output)
            .expect("failed to create jstring")
            .into_raw()
    }

    /// Called by NativeSearchPlugin.kt: nativeIsAvailable()
    #[no_mangle]
    pub extern "C" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeIsAvailable(
        _env: JNIEnv,
        _class: JClass,
    ) -> jint {
        1
    }
}
