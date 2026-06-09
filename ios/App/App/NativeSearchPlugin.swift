import Foundation
import Capacitor

// IMPORTANT: This plugin calls into libdawa_search.a via C FFI.
// The functions `dawa_search_fuzzy` and `dawa_search_is_available` are declared in
// RustBridge/dawa_search.h. That header must be imported in the Swift bridging header
// (App-Bridging-Header.h) so Swift can see the C symbols:
//
//   #import "RustBridge/dawa_search.h"
//
// If libdawa_search.a is not linked, the app will FAIL TO BUILD at the link stage —
// there is no runtime fallback for missing static library symbols. Therefore, if the
// app builds and runs, the symbols are guaranteed to be present. Run build-ios.sh and
// add libdawa_search.a + the header to the Xcode project before building.

@objc(NativeSearchPlugin)
public class NativeSearchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSearchPlugin"
    public let jsName = "NativeSearch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fuzzySearch",  returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        // dawa_search_is_available() returns 1 when the Rust library is properly linked.
        // Because the symbol must exist at link time (static library), reaching this point
        // means the library is present and functional.
        var result = JSObject()
        result["available"] = (dawa_search_is_available() == 1)
        call.resolve(result)
    }

    @objc func fuzzySearch(_ call: CAPPluginCall) {
        guard let query = call.getString("query"), !query.isEmpty else {
            call.reject("Missing query")
            return
        }
        let limit = call.getInt("limit") ?? 8

        // Run FFI call on a background thread — Jaro-Winkler over ~180 entries is fast
        // (<1 ms), but we keep the bridge thread free for other Capacitor calls.
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard self != nil else { return }

            // 4096 bytes is sufficient for 20 results × ~200 chars each.
            var outBuf = [UInt8](repeating: 0, count: 4096)
            let queryBytes = Array(query.utf8)

            // Call the Rust C API exported from libdawa_search.a.
            // Encoding: records separated by ASCII RS (0x1E), fields by ASCII US (0x1F).
            // Format per record: "name\x1Fscore\x1Frxcui"
            let count = outBuf.withUnsafeMutableBufferPointer { outPtr -> Int32 in
                queryBytes.withUnsafeBufferPointer { queryPtr in
                    dawa_search_fuzzy(
                        queryPtr.baseAddress,
                        queryBytes.count,
                        Int32(max(1, min(limit, 20))),
                        outPtr.baseAddress,
                        4096
                    )
                }
            }

            guard count > 0 else {
                var result = JSObject()
                result["results"] = [] as [Any]
                call.resolve(result)
                return
            }

            // Decode null-terminated UTF-8 output from the Rust side.
            let raw = String(bytes: outBuf.prefix(while: { $0 != 0 }), encoding: .utf8) ?? ""

            // Split on ASCII Record Separator (U+001E), parse each record's fields.
            let entries: [JSObject] = raw
                .components(separatedBy: "\u{1E}")
                .compactMap { record -> JSObject? in
                    let parts = record.components(separatedBy: "\u{1F}")
                    guard parts.count >= 2, !parts[0].isEmpty else { return nil }
                    var entry = JSObject()
                    entry["name"]  = parts[0]
                    entry["score"] = Double(parts[1]) ?? 0.0
                    if parts.count >= 3 && !parts[2].isEmpty {
                        entry["rxcui"] = parts[2]
                    }
                    return entry
                }

            var result = JSObject()
            result["results"] = entries
            call.resolve(result)
        }
    }
}
