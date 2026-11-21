package com.dawainnovation.lens

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Thread-Safe Rust JNI Bridge (`libdawa_search.so`).
 *
 * Offloads all fuzzy search, clinical interaction, spatial pharmacy indexing, vitality analytics,
 * and SHA-256 audit hashing onto a dedicated native worker pool so the Android UI / WebView
 * main thread never stalls. Each JNI call guards against `UnsatisfiedLinkError` so newly added
 * symbols degrade cleanly to the bundled Rust WASM engine if an older `.so` is packaged.
 */
@CapacitorPlugin(name = "NativeSearch")
class NativeSearchPlugin : Plugin() {

    private val rustExecutor: ExecutorService = Executors.newFixedThreadPool(2)
    private var libraryLoaded = false

    init {
        try {
            System.loadLibrary("dawa_search")
            libraryLoaded = true
        } catch (_: UnsatisfiedLinkError) {
            libraryLoaded = false
        }
    }

    // ── JNI declarations matching `rust/src/lib.rs` (android_jni module) ────
    private external fun nativeIsAvailable(): Int
    private external fun nativeFuzzySearch(query: String, limit: Int): String
    private external fun nativeCheckInteractions(drugsJson: String): String
    private external fun nativeEvaluateInteraction(medA: String, medB: String): String
    private external fun nativeIsSameDrugSubstance(medA: String, medB: String): Boolean
    private external fun nativeHaversineDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double
    private external fun nativeComputeAuditHash(prevHash: String, payload: String): String
    private external fun nativeLoadOutlets(datasetId: Int, outletsJson: String): Int
    private external fun nativeQueryOutlets(queryJson: String): String
    private external fun nativeComputeVitality(requestJson: String): String

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        rustExecutor.execute {
            val available = libraryLoaded && try {
                nativeIsAvailable() == 1
            } catch (_: Throwable) {
                false
            }
            call.resolve(JSObject().apply { put("available", available) })
        }
    }

    @PluginMethod
    fun fuzzySearch(call: PluginCall) {
        val query = call.getString("query") ?: run {
            call.reject("Missing query")
            return
        }
        val limit = (call.getInt("limit") ?: 8).coerceIn(1, 20)

        if (!libraryLoaded) {
            call.resolve(JSObject().apply { put("results", JSArray()) })
            return
        }

        rustExecutor.execute {
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
                call.resolve(JSObject().apply { put("results", results) })
            } catch (_: Throwable) {
                call.resolve(JSObject().apply { put("results", JSArray()) })
            }
        }
    }

    @PluginMethod
    fun checkInteractions(call: PluginCall) {
        val drugs = call.getArray("drugs") ?: call.getArray("rxcuis") ?: run {
            call.reject("Missing drugs array")
            return
        }
        if (!libraryLoaded) {
            call.reject("Native search library not loaded")
            return
        }
        rustExecutor.execute {
            try {
                val result = nativeCheckInteractions(drugs.toString())
                call.resolve(JSObject().apply { put("interactions", JSONArray(result)) })
            } catch (e: Throwable) {
                call.reject("Native checkInteractions unavailable: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun evaluateInteraction(call: PluginCall) {
        val medA = call.getString("medA") ?: ""
        val medB = call.getString("medB") ?: ""
        if (!libraryLoaded) {
            call.resolve(JSObject().apply { put("supported", false) })
            return
        }
        rustExecutor.execute {
            try {
                val json = nativeEvaluateInteraction(medA, medB)
                val res = JSObject().apply {
                    put("supported", true)
                    if (json.isNotEmpty()) {
                        put("interaction", JSONObject(json))
                    } else {
                        put("interaction", JSONObject.NULL)
                    }
                }
                call.resolve(res)
            } catch (_: UnsatisfiedLinkError) {
                call.resolve(JSObject().apply { put("supported", false) })
            } catch (_: Throwable) {
                call.resolve(JSObject().apply { put("supported", false) })
            }
        }
    }

    @PluginMethod
    fun isSameDrugSubstance(call: PluginCall) {
        val medA = call.getString("medA") ?: ""
        val medB = call.getString("medB") ?: ""
        if (!libraryLoaded) {
            call.resolve(JSObject().apply { put("supported", false) })
            return
        }
        rustExecutor.execute {
            try {
                val same = nativeIsSameDrugSubstance(medA, medB)
                call.resolve(JSObject().apply {
                    put("supported", true)
                    put("same", same)
                })
            } catch (_: Throwable) {
                call.resolve(JSObject().apply { put("supported", false) })
            }
        }
    }

    @PluginMethod
    fun computeAuditHash(call: PluginCall) {
        val prevHash = call.getString("prevHash") ?: ""
        val payload = call.getString("payload") ?: ""
        if (!libraryLoaded) {
            call.resolve(JSObject().apply { put("supported", false) })
            return
        }
        rustExecutor.execute {
            try {
                val hash = nativeComputeAuditHash(prevHash, payload)
                call.resolve(JSObject().apply {
                    put("supported", true)
                    put("hash", hash)
                })
            } catch (_: Throwable) {
                call.resolve(JSObject().apply { put("supported", false) })
            }
        }
    }

    @PluginMethod
    fun loadOutlets(call: PluginCall) {
        val datasetId = call.getInt("datasetId") ?: 0
        val outletsJson = call.getString("outletsJson") ?: "[]"
        if (!libraryLoaded) {
            call.resolve(JSObject().apply { put("supported", false); put("count", 0) })
            return
        }
        rustExecutor.execute {
            try {
                val count = nativeLoadOutlets(datasetId, outletsJson)
                call.resolve(JSObject().apply {
                    put("supported", count >= 0)
                    put("count", count)
                })
            } catch (_: Throwable) {
                call.resolve(JSObject().apply { put("supported", false); put("count", 0) })
            }
        }
    }

    @PluginMethod
    fun queryOutlets(call: PluginCall) {
        val queryJson = call.getString("queryJson") ?: "{}"
        if (!libraryLoaded) {
            call.resolve(JSObject().apply { put("supported", false); put("hits", JSArray()) })
            return
        }
        rustExecutor.execute {
            try {
                val json = nativeQueryOutlets(queryJson)
                call.resolve(JSObject().apply {
                    put("supported", true)
                    put("hits", JSONArray(json))
                })
            } catch (_: Throwable) {
                call.resolve(JSObject().apply { put("supported", false); put("hits", JSArray()) })
            }
        }
    }

    @PluginMethod
    fun computeVitality(call: PluginCall) {
        val requestJson = call.getString("requestJson") ?: "{}"
        if (!libraryLoaded) {
            call.resolve(JSObject().apply { put("supported", false); put("points", JSArray()) })
            return
        }
        rustExecutor.execute {
            try {
                val json = nativeComputeVitality(requestJson)
                call.resolve(JSObject().apply {
                    put("supported", true)
                    put("points", JSONArray(json))
                })
            } catch (_: Throwable) {
                call.resolve(JSObject().apply { put("supported", false); put("points", JSArray()) })
            }
        }
    }

    override fun handleOnDestroy() {
        rustExecutor.shutdown()
        super.handleOnDestroy()
    }
}
