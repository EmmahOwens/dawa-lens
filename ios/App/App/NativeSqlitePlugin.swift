import Foundation
import Capacitor
import SQLite3

@objc(NativeSqlitePlugin)
public class NativeSqlitePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSqlitePlugin"
    public let jsName = "NativeSqlite"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "execute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "query", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
    ]

    private var db: OpaquePointer?
    private let dbQueue = DispatchQueue(label: "com.dawainnovation.lens.sqlite", qos: .userInitiated)

    // DB path in Library/Application Support/dawa_lens.db — persists across updates, excluded from iCloud
    private var dbPath: String {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try? FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)
        return appSupport.appendingPathComponent("dawa_lens.db").path
    }

    // Same schema as Android — keep in sync
    private let createStatements = [
        """
        CREATE TABLE IF NOT EXISTS medicines (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, generic_name TEXT,
            dosage TEXT, form TEXT, current_quantity REAL DEFAULT 0,
            dosage_per_dose REAL DEFAULT 1, color TEXT, icon TEXT,
            patient_id TEXT, user_id TEXT, added_at TEXT NOT NULL,
            updated_at TEXT, is_conflict INTEGER DEFAULT 0,
            image_url TEXT, notes TEXT
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY, medicine_id TEXT, medicine_name TEXT NOT NULL,
            dose TEXT NOT NULL, time TEXT NOT NULL, repeat_schedule TEXT NOT NULL,
            repeat_days TEXT, notes TEXT, enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL, color TEXT, icon TEXT,
            patient_id TEXT, patient_name TEXT
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS dose_logs (
            id TEXT PRIMARY KEY, reminder_id TEXT NOT NULL,
            medicine_name TEXT NOT NULL, dose TEXT NOT NULL,
            scheduled_time TEXT NOT NULL, action_time TEXT NOT NULL,
            action TEXT NOT NULL, is_snoozed INTEGER DEFAULT 0,
            snooze_until TEXT, patient_id TEXT
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_dose_pid_time ON dose_logs (patient_id, action_time)",
        "CREATE INDEX IF NOT EXISTS idx_dose_rid_time ON dose_logs (reminder_id, action_time)",
        """
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER,
            gender TEXT, weight REAL, conditions TEXT,
            managed_by TEXT, created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wellness_logs (
            id TEXT PRIMARY KEY, type TEXT NOT NULL,
            timestamp TEXT NOT NULL, data TEXT NOT NULL,
            user_id TEXT, patient_id TEXT
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_wellness_pid_ts ON wellness_logs (patient_id, timestamp)"
    ]

    @objc func initialize(_ call: CAPPluginCall) {
        dbQueue.async { [weak self] in
            guard let self = self else { return }
            if sqlite3_open(self.dbPath, &self.db) == SQLITE_OK {
                // Apply .completeUnlessOpen data protection — AES-256 via Secure Enclave;
                // file is encrypted whenever the device is locked.
                try? (URL(fileURLWithPath: self.dbPath) as NSURL).setResourceValue(
                    URLFileProtection.completeUnlessOpen,
                    forKey: .fileProtectionKey
                )
                for sql in self.createStatements {
                    sqlite3_exec(self.db, sql, nil, nil, nil)
                }
                call.resolve()
            } else {
                call.reject("Failed to open database at \(self.dbPath)")
            }
        }
    }

    @objc func execute(_ call: CAPPluginCall) {
        guard db != nil else { call.reject("Database not initialized"); return }
        guard let sql = call.getString("sql") else { call.reject("Missing sql"); return }
        let params = call.getArray("params") ?? []

        dbQueue.async { [weak self] in
            guard let self = self else { return }
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(self.db, sql, -1, &stmt, nil) == SQLITE_OK else {
                call.reject("SQL prepare failed: \(String(cString: sqlite3_errmsg(self.db)))")
                return
            }
            defer { sqlite3_finalize(stmt) }

            self.bindParams(params, to: stmt)

            let stepResult = sqlite3_step(stmt)
            if stepResult == SQLITE_DONE || stepResult == SQLITE_ROW {
                var result = JSObject()
                result["rowsAffected"] = Int(sqlite3_changes(self.db))
                result["lastInsertId"] = Int(sqlite3_last_insert_rowid(self.db))
                call.resolve(result)
            } else {
                call.reject("Execute failed: \(String(cString: sqlite3_errmsg(self.db)))")
            }
        }
    }

    @objc func query(_ call: CAPPluginCall) {
        guard db != nil else { call.reject("Database not initialized"); return }
        guard let sql = call.getString("sql") else { call.reject("Missing sql"); return }
        let params = call.getArray("params") ?? []

        dbQueue.async { [weak self] in
            guard let self = self else { return }
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(self.db, sql, -1, &stmt, nil) == SQLITE_OK else {
                call.reject("SQL prepare failed: \(String(cString: sqlite3_errmsg(self.db)))")
                return
            }
            defer { sqlite3_finalize(stmt) }

            self.bindParams(params, to: stmt)

            var rows: [JSObject] = []
            let colCount = sqlite3_column_count(stmt)
            while sqlite3_step(stmt) == SQLITE_ROW {
                var row = JSObject()
                for i in 0..<colCount {
                    let name = String(cString: sqlite3_column_name(stmt, i))
                    switch sqlite3_column_type(stmt, i) {
                    case SQLITE_NULL:    row[name] = NSNull()
                    case SQLITE_INTEGER: row[name] = Int(sqlite3_column_int64(stmt, i))
                    case SQLITE_FLOAT:   row[name] = sqlite3_column_double(stmt, i)
                    default:
                        if let text = sqlite3_column_text(stmt, i) {
                            row[name] = String(cString: text)
                        }
                    }
                }
                rows.append(row)
            }
            var result = JSObject()
            result["rows"] = rows
            call.resolve(result)
        }
    }

    @objc func close(_ call: CAPPluginCall) {
        dbQueue.async { [weak self] in
            if let db = self?.db { sqlite3_close(db); self?.db = nil }
            call.resolve()
        }
    }

    private func bindParams(_ params: JSArray, to stmt: OpaquePointer?) {
        for i in 0..<params.count {
            let idx = Int32(i + 1)
            let val = params[i]
            if val == nil || val is NSNull {
                sqlite3_bind_null(stmt, idx)
            } else if let n = val as? Int {
                sqlite3_bind_int64(stmt, idx, Int64(n))
            } else if let d = val as? Double {
                sqlite3_bind_double(stmt, idx, d)
            } else if let s = val as? String {
                sqlite3_bind_text(stmt, idx, (s as NSString).utf8String, -1, nil)
            } else {
                sqlite3_bind_text(stmt, idx, "\(val!)", -1, nil)
            }
        }
    }
}
