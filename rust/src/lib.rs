mod search;
mod interaction;
mod scheduler;
mod parsing;
mod crypto;
mod file_ops;
mod network;
mod db;

pub use search::{fuzzy_search, DrugEntry};

/// Returns 1 — confirms the native library loaded and is functional.
#[no_mangle]
pub extern "C" fn dawa_core_is_available() -> i32 {
    1
}

#[no_mangle]
pub extern "C" fn dawa_search_is_available() -> i32 {
    1
}

// ── JNI bindings (Android only) ──────────────────────────────────────────────
#[cfg(feature = "android")]
mod jni_bindings {
    use jni::JNIEnv;
    use jni::objects::{JClass, JString, JByteArray};
    use jni::sys::{jint, jstring, jbyteArray};
    use crate::search::fuzzy_search;
    use crate::interaction;
    use crate::scheduler;
    use crate::parsing;
    use crate::crypto;
    use crate::db;

    /// Called by NativeSearchPlugin.kt: nativeFuzzySearch(query, limit)
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

    #[no_mangle]
    pub extern "C" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeCheckInteractions(
        mut env: JNIEnv,
        _class: JClass,
        rxcuis_json: JString,
    ) -> jstring {
        let json_str: String = env.get_string(&rxcuis_json).map(Into::into).unwrap_or_default();
        let rxcuis: Vec<String> = serde_json::from_str(&json_str).unwrap_or_default();

        let engine = interaction::InteractionEngine::new();
        let results = engine.check_interactions(&rxcuis);

        let output = serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string());
        env.new_string(output)
            .expect("failed to create jstring")
            .into_raw()
    }

    #[no_mangle]
    pub extern "C" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeIsAvailable(
        _env: JNIEnv,
        _class: JClass,
    ) -> jint {
        1
    }

    #[no_mangle]
    pub extern "C" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeParseLargeJson(
        mut env: JNIEnv,
        _class: JClass,
        json: JString,
    ) -> jstring {
        let j: String = env.get_string(&json).map(Into::into).unwrap_or_default();
        let result = match parsing::parse_large_json(&j) {
            Ok(v) => v.to_string(),
            Err(e) => e,
        };
        env.new_string(result)
            .expect("failed to create jstring")
            .into_raw()
    }

    #[no_mangle]
    pub extern "C" fn Java_com_dawainnovation_lens_NativeSearchPlugin_nativeHashData(
        mut env: JNIEnv,
        _class: JClass,
        data: JByteArray,
    ) -> jbyteArray {
        let input = env.convert_byte_array(&data).unwrap_or_default();
        let hashed = crypto::hash_data(&input);
        env.byte_array_from_slice(&hashed)
            .expect("failed to create byte array")
            .into_raw()
    }

    #[no_mangle]
    pub extern "C" fn Java_com_dawainnovation_lens_NativeSqlitePlugin_nativeInitialize(
        mut env: JNIEnv,
        _class: JClass,
        path: JString,
    ) -> jint {
        let path_str: String = env.get_string(&path).map(Into::into).unwrap_or_default();
        match crate::db::db_initialize(&path_str) {
            Ok(_) => 1,
            Err(e) => {
                let _ = env.throw_new("java/lang/Exception", e);
                0
            }
        }
    }

    #[no_mangle]
    pub extern "C" fn Java_com_dawainnovation_lens_NativeSqlitePlugin_nativeExecute(
        mut env: JNIEnv,
        _class: JClass,
        sql: JString,
        params_json: JString,
    ) -> jstring {
        let sql_str: String = env.get_string(&sql).map(Into::into).unwrap_or_default();
        let params_str: String = env.get_string(&params_json).map(Into::into).unwrap_or_default();
        match crate::db::db_execute(&sql_str, &params_str) {
            Ok((rows_affected, last_insert_id)) => {
                let res_json = format!(
                    "{{\"rowsAffected\":{},\"lastInsertId\":{}}}",
                    rows_affected, last_insert_id
                );
                env.new_string(res_json).expect("failed to create jstring").into_raw()
            }
            Err(e) => {
                let _ = env.throw_new("java/lang/Exception", e);
                std::ptr::null_mut()
            }
        }
    }

    #[no_mangle]
    pub extern "C" fn Java_com_dawainnovation_lens_NativeSqlitePlugin_nativeQuery(
        mut env: JNIEnv,
        _class: JClass,
        sql: JString,
        params_json: JString,
    ) -> jstring {
        let sql_str: String = env.get_string(&sql).map(Into::into).unwrap_or_default();
        let params_str: String = env.get_string(&params_json).map(Into::into).unwrap_or_default();
        match crate::db::db_query(&sql_str, &params_str) {
            Ok(json_res) => {
                env.new_string(json_res).expect("failed to create jstring").into_raw()
            }
            Err(e) => {
                let _ = env.throw_new("java/lang/Exception", e);
                std::ptr::null_mut()
            }
        }
    }

    #[no_mangle]
    pub extern "C" fn Java_com_dawainnovation_lens_NativeSqlitePlugin_nativeClose(
        _env: JNIEnv,
        _class: JClass,
    ) -> jint {
        match crate::db::db_close() {
            Ok(_) => 1,
            Err(_) => 0,
        }
    }
}

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

#[no_mangle]
pub extern "C" fn dawa_db_initialize(
    path_ptr: *const u8,
    path_len: usize,
) -> i32 {
    if path_ptr.is_null() || path_len == 0 {
        return -1;
    }
    let path = unsafe {
        match std::str::from_utf8(std::slice::from_raw_parts(path_ptr, path_len)) {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };
    match db::db_initialize(path) {
        Ok(_) => 1,
        Err(_) => -2,
    }
}

#[no_mangle]
pub extern "C" fn dawa_db_execute(
    sql_ptr: *const u8,
    sql_len: usize,
    params_ptr: *const u8,
    params_len: usize,
    out_buf: *mut u8,
    out_buf_len: usize,
) -> i32 {
    if sql_ptr.is_null() || out_buf.is_null() || out_buf_len == 0 {
        return -1;
    }
    let sql = unsafe {
        match std::str::from_utf8(std::slice::from_raw_parts(sql_ptr, sql_len)) {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };
    let params_json = if params_ptr.is_null() || params_len == 0 {
        "[]"
    } else {
        unsafe {
            match std::str::from_utf8(std::slice::from_raw_parts(params_ptr, params_len)) {
                Ok(s) => s,
                Err(_) => "[]",
            }
        }
    };
    
    match db::db_execute(sql, params_json) {
        Ok((rows_affected, last_insert_id)) => {
            let res_json = format!(
                "{{\"rowsAffected\":{},\"lastInsertId\":{}}}",
                rows_affected, last_insert_id
            );
            let bytes = res_json.as_bytes();
            let to_copy = bytes.len().min(out_buf_len - 1);
            unsafe {
                std::ptr::copy_nonoverlapping(bytes.as_ptr(), out_buf, to_copy);
                *out_buf.add(to_copy) = 0; // null-terminate
            }
            rows_affected as i32
        }
        Err(_) => -2,
    }
}

#[no_mangle]
pub extern "C" fn dawa_db_query(
    sql_ptr: *const u8,
    sql_len: usize,
    params_ptr: *const u8,
    params_len: usize,
    out_buf: *mut u8,
    out_buf_len: usize,
) -> i32 {
    if sql_ptr.is_null() || out_buf.is_null() || out_buf_len == 0 {
        return -1;
    }
    let sql = unsafe {
        match std::str::from_utf8(std::slice::from_raw_parts(sql_ptr, sql_len)) {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };
    let params_json = if params_ptr.is_null() || params_len == 0 {
        "[]"
    } else {
        unsafe {
            match std::str::from_utf8(std::slice::from_raw_parts(params_ptr, params_len)) {
                Ok(s) => s,
                Err(_) => "[]",
            }
        }
    };
    
    match db::db_query(sql, params_json) {
        Ok(json_res) => {
            let bytes = json_res.as_bytes();
            let to_copy = bytes.len().min(out_buf_len - 1);
            unsafe {
                std::ptr::copy_nonoverlapping(bytes.as_ptr(), out_buf, to_copy);
                *out_buf.add(to_copy) = 0; // null-terminate
            }
            1
        }
        Err(_) => -2,
    }
}

#[no_mangle]
pub extern "C" fn dawa_db_close() -> i32 {
    match db::db_close() {
        Ok(_) => 1,
        Err(_) => -1,
    }
}
