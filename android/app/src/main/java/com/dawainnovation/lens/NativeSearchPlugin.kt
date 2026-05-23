package com.dawainnovation.lens

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray

@CapacitorPlugin(name = "NativeSearch")
class NativeSearchPlugin : Plugin() {

    private var libraryLoaded = false

    init {
        try {
            System.loadLibrary("dawa_search")
            libraryLoaded = true
        } catch (e: UnsatisfiedLinkError) {
            // Native library not found — happens on architectures without a matching .so,
            // during unit tests, or before build-android.sh has been run.
            // The JS layer will fall back to the NLM RxNorm API transparently.
            libraryLoaded = false
        }
    }

    // ── JNI declarations ────────────────────────────────────────────────────
    // These native methods are implemented in rust/src/lib.rs (jni_bindings module)
    // and exported as Java_com_dawainnovation_lens_NativeSearchPlugin_native*.
    // They are resolved at runtime from libdawa_search.so loaded above.
    private external fun nativeFuzzySearch(query: String, limit: Int): String
    private external fun nativeIsAvailable(): Int

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val available = libraryLoaded && try {
            nativeIsAvailable() == 1
        } catch (e: Exception) {
            false
        }
        val result = JSObject()
        result.put("available", available)
        call.resolve(result)
    }

    @PluginMethod
    fun fuzzySearch(call: PluginCall) {
        val query = call.getString("query") ?: run {
            call.reject("Missing query")
            return
        }
        val limit = (call.getInt("limit") ?: 8).coerceIn(1, 20)

        if (!libraryLoaded) {
            // Native library unavailable — return empty so JS falls back to NLM API.
            val result = JSObject()
            result.put("results", JSArray())
            call.resolve(result)
            return
        }

        try {
            val json = nativeFuzzySearch(query.trim(), limit)
            val parsed = JSONArray(json)
            val results = JSArray()
            for (i in 0 until parsed.length()) {
                val item = parsed.getJSONObject(i)
                val entry = JSObject()
                entry.put("name", item.getString("name"))
                entry.put("score", item.getDouble("score"))
                val rxcui = item.optString("rxcui", "")
                if (rxcui.isNotEmpty()) {
                    entry.put("rxcui", rxcui)
                }
                results.put(entry)
            }
            val result = JSObject()
            result.put("results", results)
            call.resolve(result)
        } catch (e: Exception) {
            // Any JNI or JSON parsing error — return empty gracefully.
            val result = JSObject()
            result.put("results", JSArray())
            call.resolve(result)
        }
    }
}
