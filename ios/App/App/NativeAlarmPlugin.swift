import Foundation
import Capacitor
import UserNotifications

@objc(NativeAlarmPlugin)
public class NativeAlarmPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAlarmPlugin"
    public let jsName = "NativeAlarm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scheduleAlarms", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAllAlarms", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise)
    ]

    @objc func scheduleAlarms(_ call: CAPPluginCall) {
        guard let notifications = call.getArray("notifications") else {
            call.reject("Missing notifications array")
            return
        }

        let center = UNUserNotificationCenter.current()

        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if !granted {
                call.reject("Notification permission not granted")
                return
            }

            // Remove previously scheduled dawa alarms before adding new ones
            center.getPendingNotificationRequests { existing in
                let dawaIds = existing.filter { $0.identifier.hasPrefix("dawa_alarm_") }.map { $0.identifier }
                center.removePendingNotificationRequests(withIdentifiers: dawaIds)

                let items = notifications.compactMap { $0 as? [String: Any] }
                var scheduled = 0

                for item in items {
                    guard let id = item["id"] as? Int,
                          let title = item["title"] as? String,
                          let body = item["body"] as? String,
                          let triggerAtMillis = item["triggerAtMillis"] as? Double else { continue }

                    let triggerDate = Date(timeIntervalSince1970: triggerAtMillis / 1000.0)
                    guard triggerDate > Date() else { continue }

                    let content = UNMutableNotificationContent()
                    content.title = title
                    content.body = body
                    content.sound = .default
                    if let extraStr = item["extra"] as? String,
                       let extraData = extraStr.data(using: .utf8),
                       let extraDict = try? JSONSerialization.jsonObject(with: extraData) as? [String: Any] {
                        content.userInfo = extraDict
                    }

                    let calendar = Calendar.current
                    let components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: triggerDate)
                    let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

                    let request = UNNotificationRequest(
                        identifier: "dawa_alarm_\(id)",
                        content: content,
                        trigger: trigger
                    )

                    center.add(request) { _ in }
                    scheduled += 1
                }

                call.resolve(["scheduled": scheduled])
            }
        }
    }

    @objc func cancelAllAlarms(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { existing in
            let dawaIds = existing.filter { $0.identifier.hasPrefix("dawa_alarm_") }.map { $0.identifier }
            center.removePendingNotificationRequests(withIdentifiers: dawaIds)
            call.resolve()
        }
    }

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": true])
    }
}
