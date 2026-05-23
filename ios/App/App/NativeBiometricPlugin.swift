import Foundation
import Capacitor
import LocalAuthentication

@objc(NativeBiometricPlugin)
public class NativeBiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeBiometricPlugin"
    public let jsName = "NativeBiometric"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        var result = JSObject()
        result["available"] = canEvaluate
        if canEvaluate {
            switch context.biometryType {
            case .faceID:  result["biometryType"] = "face"
            case .touchID: result["biometryType"] = "fingerprint"
            case .opticID: result["biometryType"] = "opticid"
            default:       result["biometryType"] = "none"
            }
        } else {
            result["biometryType"] = "none"
        }
        call.resolve(result)
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Verify your identity to access your health data"
        let context = LAContext()
        context.localizedFallbackTitle = call.getString("fallbackTitle") ?? "Use Passcode"

        // .deviceOwnerAuthentication falls back to passcode when biometrics fail or are unavailable
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, error in
            var result = JSObject()
            result["success"] = success
            if let err = error {
                result["error"] = err.localizedDescription
            }
            call.resolve(result)
        }
    }
}
