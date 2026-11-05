pub mod crypto;
pub mod interaction;
pub mod search;

use std::cell::RefCell;
use std::slice;

/// Hard cap on WASM FFI string buffers (64 KiB) to prevent integer overflow or heap exhaustion.
const MAX_WASM_ALLOC_BYTES: usize = 64 * 1024;

thread_local! {
    static WASM_OUTPUT_BUF: RefCell<Vec<u8>> = RefCell::new(Vec::with_capacity(4096));
}

fn write_output_str(s: &str) -> *const u8 {
    WASM_OUTPUT_BUF.with(|buf| {
        let mut b = buf.borrow_mut();
        b.clear();
        if s.is_empty() {
            return std::ptr::null();
        }
        b.extend_from_slice(s.as_bytes());
        b.as_ptr()
    })
}

unsafe fn read_input_str<'a>(ptr: *const u8, len: usize) -> &'a str {
    if ptr.is_null() || len == 0 || len > MAX_WASM_ALLOC_BYTES {
        return "";
    }
    let bytes = slice::from_raw_parts(ptr, len);
    std::str::from_utf8(bytes).unwrap_or("")
}

// ── WebAssembly / C-ABI Exports ──────────────────────────────────────────────

/// Allocates a zero-initialized buffer of exactly `size` bytes (up to `MAX_WASM_ALLOC_BYTES`)
/// in WASM linear memory for passing UTF-8 strings from JS.
#[no_mangle]
pub extern "C" fn w_alloc(size: usize) -> *mut u8 {
    if size == 0 || size > MAX_WASM_ALLOC_BYTES {
        return std::ptr::null_mut();
    }
    let boxed: Box<[u8]> = vec![0u8; size].into_boxed_slice();
    Box::into_raw(boxed) as *mut u8
}

/// Deallocates a buffer previously allocated by `w_alloc` with matching `size`.
#[no_mangle]
pub unsafe extern "C" fn w_dealloc(ptr: *mut u8, size: usize) {
    if !ptr.is_null() && size > 0 && size <= MAX_WASM_ALLOC_BYTES {
        let slice_ptr = slice::from_raw_parts_mut(ptr, size);
        drop(Box::from_raw(slice_ptr));
    }
}

/// Returns the byte length of the most recent string written to `WASM_OUTPUT_BUF`.
#[no_mangle]
pub extern "C" fn w_last_len() -> usize {
    WASM_OUTPUT_BUF.with(|buf| buf.borrow().len())
}

/// Great-circle Haversine distance in kilometers (rounded to 0.1 km).
#[no_mangle]
pub extern "C" fn dawa_haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    search::haversine_distance_km(lat1, lon1, lat2, lon2)
}

/// Returns 1 if `drug_a` and `drug_b` represent the same active substance, 0 otherwise.
#[no_mangle]
pub unsafe extern "C" fn dawa_is_same_substance(
    ptr_a: *const u8,
    len_a: usize,
    ptr_b: *const u8,
    len_b: usize,
) -> i32 {
    let a = read_input_str(ptr_a, len_a);
    let b = read_input_str(ptr_b, len_b);
    if interaction::is_same_drug_substance(a, b) {
        1
    } else {
        0
    }
}

/// Normalizes a drug string and writes the result to `WASM_OUTPUT_BUF`.
#[no_mangle]
pub unsafe extern "C" fn dawa_normalize_drug(ptr: *const u8, len: usize) -> *const u8 {
    let input = read_input_str(ptr, len);
    let norm = interaction::normalize_drug_string(input);
    write_output_str(&norm)
}

/// Resolves a free-form drug query to a JSON `ClinicalDrugDef` (or empty string if none).
#[no_mangle]
pub unsafe extern "C" fn dawa_resolve_canonical_json(ptr: *const u8, len: usize) -> *const u8 {
    let query = read_input_str(ptr, len);
    match interaction::resolve_canonical_drug(query) {
        Some(def) => {
            let json = serde_json::to_string(def).unwrap_or_default();
            write_output_str(&json)
        }
        None => write_output_str(""),
    }
}

/// Evaluates clinical interaction between two drug strings and writes JSON `ParsedInteraction`
/// (or empty string if no interaction / duplicate substance).
#[no_mangle]
pub unsafe extern "C" fn dawa_evaluate_interaction_json(
    ptr_a: *const u8,
    len_a: usize,
    ptr_b: *const u8,
    len_b: usize,
) -> *const u8 {
    let a = read_input_str(ptr_a, len_a);
    let b = read_input_str(ptr_b, len_b);
    match interaction::evaluate_clinical_interaction(a, b) {
        Some(hit) => {
            let json = serde_json::to_string(&hit).unwrap_or_default();
            write_output_str(&json)
        }
        None => write_output_str(""),
    }
}

/// Evaluates all pairs in a JSON array of drug strings and returns a JSON array of `ParsedInteraction`.
#[no_mangle]
pub unsafe extern "C" fn dawa_check_interactions_json(ptr: *const u8, len: usize) -> *const u8 {
    let drugs_json = read_input_str(ptr, len);
    let out = interaction::check_interactions(drugs_json);
    write_output_str(&out)
}

/// Performs Jaro-Winkler fuzzy search over the embedded drug index and returns a JSON array.
#[no_mangle]
pub unsafe extern "C" fn dawa_fuzzy_search_json(
    ptr: *const u8,
    len: usize,
    limit: usize,
) -> *const u8 {
    let query = read_input_str(ptr, len);
    let results = search::fuzzy_search(query, limit);
    let json = serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string());
    write_output_str(&json)
}

// ── Android JNI Bridge (compiled only when `--features android` is active) ───

#[cfg(feature = "android")]
mod android_jni {
    use crate::{crypto, interaction, search};
    use jni::objects::{JClass, JString};
    use jni::sys::{jboolean, jdouble, jint, jstring, JNI_FALSE, JNI_TRUE};
    use jni::JNIEnv;

    fn jstring_to_rust(env: &mut JNIEnv, s: &JString) -> String {
        env.get_string(s).map(|j| j.into()).unwrap_or_default()
    }

    fn rust_to_jstring(env: &mut JNIEnv, s: &str, fallback: &str) -> jstring {
        env.new_string(s)
            .unwrap_or_else(|_| env.new_string(fallback).expect("fallback JString"))
            .into_raw()
    }

    #[no_mangle]
    pub extern "system" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeIsAvailable(
        _env: JNIEnv,
        _class: JClass,
    ) -> jint {
        1
    }

    #[no_mangle]
    pub extern "system" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeFuzzySearch(
        mut env: JNIEnv,
        _class: JClass,
        query: JString,
        limit: jint,
    ) -> jstring {
        let query_str = jstring_to_rust(&mut env, &query);
        let results = search::fuzzy_search(&query_str, limit.max(1) as usize);
        let json = serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string());
        rust_to_jstring(&mut env, &json, "[]")
    }

    #[no_mangle]
    pub extern "system" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeCheckInteractions(
        mut env: JNIEnv,
        _class: JClass,
        drugs_json: JString,
    ) -> jstring {
        let json_str = jstring_to_rust(&mut env, &drugs_json);
        let result = interaction::check_interactions(&json_str);
        rust_to_jstring(&mut env, &result, "[]")
    }

    #[no_mangle]
    pub extern "system" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeEvaluateInteraction(
        mut env: JNIEnv,
        _class: JClass,
        med_a: JString,
        med_b: JString,
    ) -> jstring {
        let a = jstring_to_rust(&mut env, &med_a);
        let b = jstring_to_rust(&mut env, &med_b);
        let json = interaction::evaluate_clinical_interaction(&a, &b)
            .and_then(|hit| serde_json::to_string(&hit).ok())
            .unwrap_or_default();
        rust_to_jstring(&mut env, &json, "")
    }

    #[no_mangle]
    pub extern "system" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeIsSameDrugSubstance(
        mut env: JNIEnv,
        _class: JClass,
        med_a: JString,
        med_b: JString,
    ) -> jboolean {
        let a = jstring_to_rust(&mut env, &med_a);
        let b = jstring_to_rust(&mut env, &med_b);
        if interaction::is_same_drug_substance(&a, &b) {
            JNI_TRUE
        } else {
            JNI_FALSE
        }
    }

    #[no_mangle]
    pub extern "system" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeHaversineDistance(
        _env: JNIEnv,
        _class: JClass,
        lat1: jdouble,
        lon1: jdouble,
        lat2: jdouble,
        lon2: jdouble,
    ) -> jdouble {
        search::haversine_distance_km(lat1, lon1, lat2, lon2)
    }

    #[no_mangle]
    pub extern "system" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeComputeAuditHash(
        mut env: JNIEnv,
        _class: JClass,
        prev_hash: JString,
        payload: JString,
    ) -> jstring {
        let prev = jstring_to_rust(&mut env, &prev_hash);
        let pay = jstring_to_rust(&mut env, &payload);
        let result = crypto::compute_audit_hash(&prev, &pay);
        rust_to_jstring(&mut env, &result, "")
    }
}

// ── Unit Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use crate::{interaction, search};

    #[test]
    fn exact_prefix_ranks_first() {
        let results = search::fuzzy_search("paracet", 5);
        assert!(!results.is_empty());
        assert_eq!(results[0].name.to_lowercase(), "paracetamol");
    }

    #[test]
    fn typo_tolerant_search() {
        let results = search::fuzzy_search("amoxicilin", 5);
        assert!(!results.is_empty());
        assert!(results[0].name.to_lowercase().contains("amoxicillin"));
    }

    #[test]
    fn empty_query_returns_empty() {
        let results = search::fuzzy_search("", 10);
        assert!(results.is_empty());
    }

    #[test]
    fn limit_is_respected() {
        let results = search::fuzzy_search("a", 3);
        assert!(results.len() <= 3);
    }

    #[test]
    fn haversine_kampala_to_entebbe() {
        // Kampala (0.3476, 32.5825) to Entebbe (0.0512, 32.4637) ~ 35.5 km
        let dist = search::haversine_distance_km(0.3476, 32.5825, 0.0512, 32.4637);
        assert!(dist > 30.0 && dist < 40.0, "dist was {}", dist);
    }

    #[test]
    fn check_interactions_json_array() {
        let json = interaction::check_interactions(r#"["Warfarin", "Ibuprofen 400mg"]"#);
        assert!(json.contains("Severe Gastrointestinal Hemorrhage Risk"));
    }
}
