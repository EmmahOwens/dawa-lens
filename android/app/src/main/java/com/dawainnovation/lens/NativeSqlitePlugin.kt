package com.dawainnovation.lens

import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(name = "NativeSqlite")
class NativeSqlitePlugin : Plugin() {

    private var libraryLoaded = false

    init {
        try {
            System.loadLibrary("dawa_search")
            libraryLoaded = true
        } catch (e: UnsatisfiedLinkError) {
            // Fallback when library not loaded (e.g. testing or build not run yet)
            libraryLoaded = false
        }
    }

    // JNI declarations mapping to rust/src/lib.rs
    private external fun nativeInitialize(path: String): Int
    private external fun nativeExecute(sql: String, paramsJson: String): String
    private external fun nativeQuery(sql: String, paramsJson: String): String
    private external fun nativeClose(): Int

    @PluginMethod
    fun initialize(call: PluginCall) {
        if (!libraryLoaded) {
            call.reject("Rust database library not loaded")
            return
        }
        try {
            val dbPath = context.getDatabasePath("dawa_lens.db").absolutePath
            val result = nativeInitialize(dbPath)
            if (result == 1) {
                call.resolve()
            } else {
                call.reject("Failed to initialize Rust database")
            }
        } catch (e: Exception) {
            call.reject("Rust database init failed: ${e.message}", e)
        }
    }

    @PluginMethod
    fun execute(call: PluginCall) {
        if (!libraryLoaded) {
            call.reject("Rust database library not loaded")
            return
        }
        val sql = call.getString("sql") ?: run { call.reject("Missing sql"); return }
        val rawParams = call.getArray("params") ?: JSArray()

        try {
            val resultJson = nativeExecute(sql, rawParams.toString())
            val obj = JSONObject(resultJson)
            val res = JSObject()
            res.put("rowsAffected", obj.getInt("rowsAffected"))
            res.put("lastInsertId", obj.optInt("lastInsertId", 0))
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("Rust database execute failed: ${e.message}", e)
        }
    }

    @PluginMethod
    fun query(call: PluginCall) {
        if (!libraryLoaded) {
            call.reject("Rust database library not loaded")
            return
        }
        val sql = call.getString("sql") ?: run { call.reject("Missing sql"); return }
        val rawParams = call.getArray("params") ?: JSArray()

        try {
            val resultJson = nativeQuery(sql, rawParams.toString())
            val rows = JSONArray(resultJson)
            val res = JSObject()
            res.put("rows", rows)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("Rust database query failed: ${e.message}", e)
        }
    }

    @PluginMethod
    fun close(call: PluginCall) {
        if (!libraryLoaded) {
            call.resolve()
            return
        }
        nativeClose()
        call.resolve()
    }
}
