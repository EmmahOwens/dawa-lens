import Foundation
import Capacitor
import UIKit

@objc(NativeCameraPlugin)
public class NativeCameraPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeCameraPlugin"
    public let jsName = "NativeCamera"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startScan", returnType: CAPPluginReturnPromise)
    ]

    private var savedCall: CAPPluginCall?

    @objc func startScan(_ call: CAPPluginCall) {
        savedCall = call
        let mode = call.getString("mode") ?? "pill"

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let scanVC = NativeScanViewController()
            scanVC.scanMode = mode
            scanVC.modalPresentationStyle = .fullScreen
            scanVC.onCapture = { [weak self] imageData in
                guard let self = self else { return }
                var result = JSObject()
                result["imageData"] = imageData
                result["cancelled"] = false
                self.savedCall?.resolve(result)
                self.savedCall = nil
            }
            scanVC.onCancel = { [weak self] in
                guard let self = self else { return }
                var result = JSObject()
                result["imageData"] = ""
                result["cancelled"] = true
                self.savedCall?.resolve(result)
                self.savedCall = nil
            }
            self.bridge?.viewController?.present(scanVC, animated: true)
        }
    }
}
