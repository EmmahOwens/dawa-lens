package com.dawainnovation.lens

import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

@CapacitorPlugin(name = "NativeSqlite")
class NativeSqlitePlugin : Plugin() {

    private var db: SQLiteDatabase? = null

    companion object {
        const val DB_NAME = "dawa_lens.db"
        const val DB_VERSION = 1

        // Full schema — keep in sync with iOS
        val CREATE_STATEMENTS = listOf(
            """CREATE TABLE IF NOT EXISTS medicines (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, generic_name TEXT,
                dosage TEXT, form TEXT, current_quantity REAL DEFAULT 0,
                dosage_per_dose REAL DEFAULT 1, color TEXT, icon TEXT,
                patient_id TEXT, user_id TEXT, added_at TEXT NOT NULL,
                updated_at TEXT, is_conflict INTEGER DEFAULT 0,
                image_url TEXT, notes TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY, medicine_id TEXT, medicine_name TEXT NOT NULL,
                dose TEXT NOT NULL, time TEXT NOT NULL, repeat_schedule TEXT NOT NULL,
                repeat_days TEXT, notes TEXT, enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL, color TEXT, icon TEXT,
                patient_id TEXT, patient_name TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS dose_logs (
                id TEXT PRIMARY KEY, reminder_id TEXT NOT NULL,
                medicine_name TEXT NOT NULL, dose TEXT NOT NULL,
                scheduled_time TEXT NOT NULL, action_time TEXT NOT NULL,
                action TEXT NOT NULL, is_snoozed INTEGER DEFAULT 0,
                snooze_until TEXT, patient_id TEXT
            )""",
            "CREATE INDEX IF NOT EXISTS idx_dose_pid_time ON dose_logs (patient_id, action_time)",
            "CREATE INDEX IF NOT EXISTS idx_dose_rid_time ON dose_logs (reminder_id, action_time)",
            """CREATE TABLE IF NOT EXISTS patients (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER,
                gender TEXT, weight REAL, conditions TEXT,
                managed_by TEXT, created_at TEXT NOT NULL
            )""",
            """CREATE TABLE IF NOT EXISTS wellness_logs (
                id TEXT PRIMARY KEY, type TEXT NOT NULL,
                timestamp TEXT NOT NULL, data TEXT NOT NULL,
                user_id TEXT, patient_id TEXT
            )""",
            "CREATE INDEX IF NOT EXISTS idx_wellness_pid_ts ON wellness_logs (patient_id, timestamp)"
        )
    }

    @PluginMethod
    fun initialize(call: PluginCall) {
        try {
            val helper = object : SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {
                override fun onCreate(database: SQLiteDatabase) {
                    CREATE_STATEMENTS.forEach { database.execSQL(it) }
                }
                override fun onUpgrade(database: SQLiteDatabase, oldV: Int, newV: Int) {}
            }
            db = helper.writableDatabase
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to initialize database: ${e.message}", e)
        }
    }

    @PluginMethod
    fun execute(call: PluginCall) {
        val database = db ?: run { call.reject("Database not initialized. Call initialize() first."); return }
        val sql = call.getString("sql") ?: run { call.reject("Missing sql"); return }
        val rawParams = call.getArray("params")

        try {
            val bindArgs = rawParams?.let { arr ->
                Array(arr.length()) { i ->
                    when (val v = arr.get(i)) {
                        null, JSONObject.NULL -> null
                        is String -> v
                        is Number -> v.toString()
                        is Boolean -> if (v) "1" else "0"
                        else -> v.toString()
                    }
                }
            }
            database.execSQL(sql, bindArgs ?: emptyArray())
            val result = JSObject()
            result.put("rowsAffected", 1) // SQLite doesn't provide this without extra query for execSQL
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Execute failed: ${e.message}", e)
        }
    }

    @PluginMethod
    fun query(call: PluginCall) {
        val database = db ?: run { call.reject("Database not initialized"); return }
        val sql = call.getString("sql") ?: run { call.reject("Missing sql"); return }
        val rawParams = call.getArray("params")

        try {
            val selectionArgs = rawParams?.let { arr ->
                Array(arr.length()) { i ->
                    when (val v = arr.get(i)) {
                        null, JSONObject.NULL -> "null"
                        else -> v.toString()
                    }
                }
            }
            val cursor = database.rawQuery(sql, selectionArgs)
            val rows = JSArray()
            val columns = cursor.columnNames

            while (cursor.moveToNext()) {
                val row = JSObject()
                columns.forEach { col ->
                    val idx = cursor.getColumnIndex(col)
                    if (idx >= 0) {
                        when (cursor.getType(idx)) {
                            android.database.Cursor.FIELD_TYPE_NULL    -> row.put(col, JSONObject.NULL)
                            android.database.Cursor.FIELD_TYPE_INTEGER -> row.put(col, cursor.getLong(idx))
                            android.database.Cursor.FIELD_TYPE_FLOAT   -> row.put(col, cursor.getDouble(idx))
                            else                                        -> row.put(col, cursor.getString(idx))
                        }
                    }
                }
                rows.put(row)
            }
            cursor.close()

            val result = JSObject()
            result.put("rows", rows)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Query failed: ${e.message}", e)
        }
    }

    @PluginMethod
    fun close(call: PluginCall) {
        db?.close()
        db = null
        call.resolve()
    }
}
