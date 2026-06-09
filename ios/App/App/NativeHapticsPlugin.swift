import Foundation
import Capacitor

@objc(NativeHapticsPlugin)
public class NativeHapticsPlugin: CAPPlugin {

    @objc func impact(_ call: CAPPluginCall) {
        let styleStr = call.getString("style") ?? "medium"
        var style: UIImpactFeedbackGenerator.FeedbackStyle = .medium

        switch styleStr {
        case "light":
            style = .light
        case "heavy":
            style = .heavy
        default:
            style = .medium
        }

        DispatchQueue.main.async {
            let generator = UIImpactFeedbackGenerator(style: style)
            generator.prepare()
            generator.impactOccurred()
        }
        call.resolve()
    }

    @objc func notification(_ call: CAPPluginCall) {
        let typeStr = call.getString("type") ?? "success"
        var type: UINotificationFeedbackGenerator.FeedbackType = .success

        switch typeStr {
        case "warning":
            type = .warning
        case "error":
            type = .error
        default:
            type = .success
        }

        DispatchQueue.main.async {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(type)
        }
        call.resolve()
    }
}
