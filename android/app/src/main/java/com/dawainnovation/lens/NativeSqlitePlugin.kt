package com.dawainnovation.lens

import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteStatement
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * High-performance, security-hardened Native SQLite Plugin powered directly by Android's built-in
 * C SQLite engine (`android.database.sqlite.SQLiteDatabase`) in Write-Ahead Logging (WAL) mode
 * on a dedicated background thread.
 *
 * Security & Performance Controls:
 * - Eliminates the 4x JSON-over-JNI serialization overhead and prevents dual-SQLite connection
 *   locking conflicts with `MissedDoseWorker` and `NativeActionReceiver`.
 * - Enforces single-statement parameterized execution and restricts bridge callers to `SELECT`,
 *   `INSERT`, `UPDATE`, and `DELETE` on allowlisted application tables (blocking `ATTACH`,
 *   `PRAGMA`, `DROP`, `ALTER`, and stacked `;` queries over the WebView bridge).
 */
@CapacitorPlugin(name = "NativeSqlite")
class NativeSqlitePlugin : Plugin() {

    companion object {
        private const val MAX_SQL_LENGTH = 8192
        private val ALLOWED_TABLES = setOf(
            "medicines",
            "reminders",
            "dose_logs",
            "patients",
            "wellness_logs",
            "audit_logs"
        )
        private val FORBIDDEN_KEYWORDS = Regex(
            """\b(ATTACH|DETACH|PRAGMA|VACUUM|ALTER|DROP|CREATE|LOAD_EXTENSION| SQLITE_MASTER|SQLITE_TEMP_MASTER)\b""",
            RegexOption.IGNORE_CASE
        )
        private val TABLE_EXTRACTOR = Regex(
            """^\s*(?:SELECT\s+.+?\s+FROM|INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b""",
            setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
        )
    }

    private val dbExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    @Volatile
    private var database: SQLiteDatabase? = null

    /**
     * Validates that a bridge-supplied SQL string is a single, non-administrative statement
     * targeting an allowlisted application table.
     */
    private fun validateBridgeSql(rawSql: String, isQuery: Boolean): String {
        val trimmed = rawSql.trim().removeSuffix(";").trim()
        if (trimmed.isEmpty() || trimmed.length > MAX_SQL_LENGTH) {
            throw SecurityException("SQL statement is empty or exceeds maximum length")
        }
        // Reject stacked statements or SQL comments
        if (trimmed.contains(';') || trimmed.contains("--") || trimmed.contains("/*")) {
            throw SecurityException("Multi-statement or commented SQL is not permitted")
        }
        if (FORBIDDEN_KEYWORDS.containsMatchIn(trimmed)) {
            throw SecurityException("Administrative SQL directives are not permitted over bridge")
        }

        val upper = trimmed.uppercase(Locale.ROOT)
        if (isQuery) {
            if (!upper.startsWith("SELECT ")) {
                throw SecurityException("query() only permits SELECT statements")
            }
        } else {
            if (!upper.startsWith("INSERT ") && !upper.startsWith("UPDATE ") && !upper.startsWith("DELETE ")) {
                throw SecurityException("execute() only permits INSERT, UPDATE, or DELETE statements")
            }
        }

        val match = TABLE_EXTRACTOR.find(trimmed)
            ?: throw SecurityException("Unable to verify target table in SQL statement")
        val tableName = match.groupValues[1].lowercase(Locale.ROOT)
        if (tableName !in ALLOWED_TABLES) {
            throw SecurityException("Target table '$tableName' is not in allowlist")
        }

        return trimmed
    }

    @Synchronized
    private fun getOrInitDatabase(): SQLiteDatabase {
        database?.let {
            if (it.isOpen) return it
        }

        val dbFile = context.getDatabasePath("dawa_lens.db")
        dbFile.parentFile?.mkdirs()

        val db = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
        try {
            db.enableWriteAheadLogging()
        } catch (_: Exception) {
            // WAL already enabled or unsupported on filesystem
        }
        db.execSQL("PRAGMA synchronous = NORMAL;")
        db.execSQL("PRAGMA foreign_keys = ON;")

        initSchema(db)
        database = db
        return db
    }

    private fun initSchema(db: SQLiteDatabase) {
        db.beginTransaction()
        try {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS medicines (
                    id TEXT PRIMARY KEY NOT NULL,
                    name TEXT NOT NULL,
                    generic_name TEXT,
                    dosage TEXT,
                    form TEXT,
                    current_quantity INTEGER DEFAULT 0,
                    dosage_per_dose INTEGER DEFAULT 1,
                    frequency_per_day REAL,
                    color TEXT,
                    icon TEXT,
                    patient_id TEXT,
                    user_id TEXT,
                    added_at TEXT NOT NULL,
                    updated_at TEXT,
                    is_conflict INTEGER DEFAULT 0,
                    image_url TEXT,
                    notes TEXT
                );
                """.trimIndent()
            )

            // Ensure existing installations get `frequency_per_day` column if migrated from older schema
            try {
                db.rawQuery("PRAGMA table_info(medicines)", null).use { cursor ->
                    var hasFreqCol = false
                    val nameIdx = cursor.getColumnIndex("name")
                    while (cursor.moveToNext()) {
                        if (nameIdx >= 0 && cursor.getString(nameIdx) == "frequency_per_day") {
                            hasFreqCol = true
                            break
                        }
                    }
                    if (!hasFreqCol) {
                        db.execSQL("ALTER TABLE medicines ADD COLUMN frequency_per_day REAL;")
                    }
                }
            } catch (_: Exception) {
                // Ignore if column already exists
            }

            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS reminders (
                    id TEXT PRIMARY KEY NOT NULL,
                    medicine_id TEXT,
                    medicine_name TEXT NOT NULL,
                    dose TEXT NOT NULL,
                    time TEXT NOT NULL,
                    repeat_schedule TEXT NOT NULL DEFAULT 'daily',
                    repeat_days TEXT,
                    notes TEXT,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    patient_id TEXT,
                    patient_name TEXT
                );
                """.trimIndent()
            )

            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS dose_logs (
                    id TEXT PRIMARY KEY NOT NULL,
                    reminder_id TEXT NOT NULL,
                    medicine_name TEXT NOT NULL,
                    dose TEXT NOT NULL,
                    scheduled_time TEXT NOT NULL,
                    action_time TEXT NOT NULL,
                    action TEXT NOT NULL,
                    is_snoozed INTEGER DEFAULT 0,
                    snooze_until TEXT,
                    patient_id TEXT
                );
                """.trimIndent()
            )

            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS patients (
                    id TEXT PRIMARY KEY NOT NULL,
                    name TEXT NOT NULL,
                    age INTEGER,
                    gender TEXT,
                    weight REAL,
                    conditions TEXT,
                    managed_by TEXT,
                    created_at TEXT NOT NULL
                );
                """.trimIndent()
            )

            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS wellness_logs (
                    id TEXT PRIMARY KEY NOT NULL,
                    type TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    data TEXT NOT NULL,
                    user_id TEXT,
                    patient_id TEXT
                );
                """.trimIndent()
            )

            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    prev_hash TEXT NOT NULL,
                    curr_hash TEXT NOT NULL
                );
                """.trimIndent()
            )

            db.execSQL("CREATE INDEX IF NOT EXISTS idx_dose_logs_reminder_id ON dose_logs(reminder_id);")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_dose_logs_action_time ON dose_logs(action_time);")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_reminders_medicine_id ON reminders(medicine_id);")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_medicines_added_at ON medicines(added_at);")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_wellness_logs_timestamp ON wellness_logs(timestamp);")

            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun bindParams(stmt: SQLiteStatement, params: JSArray) {
        stmt.clearBindings()
        for (i in 0 until params.length()) {
            val idx = i + 1
            if (params.isNull(i)) {
                stmt.bindNull(idx)
                continue
            }
            when (val value = params.get(i)) {
                null, JSONObject.NULL -> stmt.bindNull(idx)
                is Boolean -> stmt.bindLong(idx, if (value) 1L else 0L)
                is Int -> stmt.bindLong(idx, value.toLong())
                is Long -> stmt.bindLong(idx, value)
                is Float -> stmt.bindDouble(idx, value.toDouble())
                is Double -> stmt.bindDouble(idx, value)
                is Number -> stmt.bindDouble(idx, value.toDouble())
                else -> stmt.bindString(idx, value.toString())
            }
        }
    }

    @PluginMethod
    fun initialize(call: PluginCall) {
        dbExecutor.execute {
            try {
                getOrInitDatabase()
                call.resolve()
            } catch (e: Exception) {
                call.reject("Native SQLite init failed: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun execute(call: PluginCall) {
        val rawSql = call.getString("sql") ?: run {
            call.reject("Missing sql")
            return
        }
        val rawParams = call.getArray("params") ?: JSArray()

        dbExecutor.execute {
            try {
                val sql = validateBridgeSql(rawSql, isQuery = false)
                val db = getOrInitDatabase()
                val trimmedUpper = sql.uppercase(Locale.ROOT)
                var rowsAffected = 0
                var lastInsertId = 0L

                db.compileStatement(sql).use { stmt ->
                    bindParams(stmt, rawParams)
                    if (trimmedUpper.startsWith("INSERT")) {
                        val rowId = stmt.executeInsert()
                        if (rowId != -1L) {
                            lastInsertId = rowId
                            rowsAffected = 1
                        }
                    } else {
                        rowsAffected = stmt.executeUpdateDelete()
                    }
                }

                val res = JSObject()
                res.put("rowsAffected", rowsAffected)
                res.put("lastInsertId", lastInsertId)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Native SQLite execute failed: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun query(call: PluginCall) {
        val rawSql = call.getString("sql") ?: run {
            call.reject("Missing sql")
            return
        }
        val rawParams = call.getArray("params") ?: JSArray()

        dbExecutor.execute {
            try {
                val sql = validateBridgeSql(rawSql, isQuery = true)
                val db = getOrInitDatabase()
                val args = Array<String?>(rawParams.length()) { i ->
                    if (rawParams.isNull(i)) null else {
                        when (val v = rawParams.get(i)) {
                            null, JSONObject.NULL -> null
                            is Boolean -> if (v) "1" else "0"
                            else -> v.toString()
                        }
                    }
                }

                val rows = JSONArray()
                db.rawQuery(sql, args).use { cursor ->
                    val colCount = cursor.columnCount
                    val colNames = cursor.columnNames
                    while (cursor.moveToNext()) {
                        val rowObj = JSONObject()
                        for (i in 0 until colCount) {
                            val name = colNames[i]
                            when (cursor.getType(i)) {
                                Cursor.FIELD_TYPE_NULL -> rowObj.put(name, JSONObject.NULL)
                                Cursor.FIELD_TYPE_INTEGER -> rowObj.put(name, cursor.getLong(i))
                                Cursor.FIELD_TYPE_FLOAT -> rowObj.put(name, cursor.getDouble(i))
                                Cursor.FIELD_TYPE_STRING -> rowObj.put(name, cursor.getString(i))
                                Cursor.FIELD_TYPE_BLOB -> {
                                    val blob = cursor.getBlob(i)
                                    rowObj.put(name, if (blob != null) String(blob, Charsets.UTF_8) else JSONObject.NULL)
                                }
                            }
                        }
                        rows.put(rowObj)
                    }
                }

                val res = JSObject()
                res.put("rows", rows)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Native SQLite query failed: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun close(call: PluginCall) {
        dbExecutor.execute {
            try {
                synchronized(this) {
                    database?.close()
                    database = null
                }
                call.resolve()
            } catch (e: Exception) {
                call.reject("Native SQLite close failed: ${e.message}", e)
            }
        }
    }

    override fun handleOnDestroy() {
        try {
            synchronized(this) {
                database?.close()
                database = null
            }
        } catch (_: Exception) {
        }
        dbExecutor.shutdown()
        super.handleOnDestroy()
    }
}
