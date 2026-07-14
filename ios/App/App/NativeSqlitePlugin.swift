import Foundation
import Capacitor

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

    private let dbQueue = DispatchQueue(label: "com.dawainnovation.lens.sqlite", qos: .userInitiated)

    private var dbPath: String {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try? FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)
        return appSupport.appendingPathComponent("dawa_lens.db").path
    }

    @objc func initialize(_ call: CAPPluginCall) {
        dbQueue.async { [weak self] in
            guard let self = self else { return }
            let pathBytes = Array(self.dbPath.utf8)
            let res = pathBytes.withUnsafeBufferPointer { pathPtr in
                dawa_db_initialize(pathPtr.baseAddress, pathBytes.count)
            }
            if res == 1 {
                // Apply data protection standard
                try? (URL(fileURLWithPath: self.dbPath) as NSURL).setResourceValue(
                    URLFileProtection.completeUnlessOpen,
                    forKey: .fileProtectionKey
                )
                call.resolve()
            } else {
                call.reject("Failed to initialize Rust database (code \(res))")
            }
        }
    }

    @objc func execute(_ call: CAPPluginCall) {
        guard let sql = call.getString("sql") else { call.reject("Missing sql"); return }
        let params = call.getArray("params") ?? []

        dbQueue.async {
            let sqlBytes = Array(sql.utf8)
            let paramsJsonData = try? JSONSerialization.data(withJSONObject: params, options: [])
            let paramsBytes = paramsJsonData != nil ? Array(paramsJsonData!) : []
            
            // 4096 bytes is sufficient for execute results (just rowsAffected / lastInsertId JSON)
            var outBuf = [UInt8](repeating: 0, count: 4096)
            let rowsAffected = outBuf.withUnsafeMutableBufferPointer { outPtr -> Int32 in
                sqlBytes.withUnsafeBufferPointer { sqlPtr in
                    paramsBytes.withUnsafeBufferPointer { paramsPtr in
                        dawa_db_execute(
                            sqlPtr.baseAddress, sqlBytes.count,
                            paramsPtr.baseAddress, paramsBytes.count,
                            outPtr.baseAddress, 4096
                        )
                    }
                }
            }

            if rowsAffected >= 0 {
                let raw = String(bytes: outBuf.prefix(while: { $0 != 0 }), encoding: .utf8) ?? "{}"
                if let data = raw.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                    var result = JSObject()
                    result["rowsAffected"] = json["rowsAffected"] as? Int ?? Int(rowsAffected)
                    result["lastInsertId"] = json["lastInsertId"] as? Int ?? 0
                    call.resolve(result)
                } else {
                    var result = JSObject()
                    result["rowsAffected"] = Int(rowsAffected)
                    result["lastInsertId"] = 0
                    call.resolve(result)
                }
            } else {
                call.reject("Rust execute failed (code \(rowsAffected))")
            }
        }
    }

    @objc func query(_ call: CAPPluginCall) {
        guard let sql = call.getString("sql") else { call.reject("Missing sql"); return }
        let params = call.getArray("params") ?? []

        dbQueue.async {
            let sqlBytes = Array(sql.utf8)
            let paramsJsonData = try? JSONSerialization.data(withJSONObject: params, options: [])
            let paramsBytes = paramsJsonData != nil ? Array(paramsJsonData!) : []
            
            // Allocate larger buffer for queries: 256KB to fit reminders/logs
            var outBuf = [UInt8](repeating: 0, count: 262144)
            let res = outBuf.withUnsafeMutableBufferPointer { outPtr -> Int32 in
                sqlBytes.withUnsafeBufferPointer { sqlPtr in
                    paramsBytes.withUnsafeBufferPointer { paramsPtr in
                        dawa_db_query(
                            sqlPtr.baseAddress, sqlBytes.count,
                            paramsPtr.baseAddress, paramsBytes.count,
                            outPtr.baseAddress, 262144
                        )
                    }
                }
            }

            if res == 1 {
                let raw = String(bytes: outBuf.prefix(while: { $0 != 0 }), encoding: .utf8) ?? "[]"
                if let data = raw.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [Any] {
                    var result = JSObject()
                    result["rows"] = json
                    call.resolve(result)
                } else {
                    call.reject("Rust query returned invalid JSON")
                }
            } else {
                call.reject("Rust query failed (code \(res))")
            }
        }
    }

    @objc func close(_ call: CAPPluginCall) {
        dbQueue.async {
            dawa_db_close()
            call.resolve()
        }
    }
}
