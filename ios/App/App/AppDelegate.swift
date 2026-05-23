import UIKit
import Capacitor
import BackgroundTasks

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.

        // NativeOcrPlugin, NativeAlarmPlugin, NativeCameraPlugin, NativeSqlitePlugin,
        // NativeBiometricPlugin, NativePdfPlugin, and NativeLocationPlugin are all
        // auto-discovered by Capacitor (CAPBridgedPlugin). No manual registration needed.

        // Register background app refresh task for missed-dose checking
        if #available(iOS 13.0, *) {
            BGTaskScheduler.shared.register(
                forTaskWithIdentifier: "com.dawainnovation.lens.missed-dose-check",
                using: nil
            ) { task in
                self.handleMissedDoseCheck(task: task as! BGAppRefreshTask)
            }
        }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // MARK: – Background task handlers

    @available(iOS 13.0, *)
    private func handleMissedDoseCheck(task: BGAppRefreshTask) {
        scheduleNextMissedDoseCheck() // Re-schedule immediately so the next run is queued

        // Open the SQLite DB and check for missed doses
        // (mirrors Android WorkManager logic — reads dawa_lens.db, checks dose_logs)
        let dbPath = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first!.appendingPathComponent("dawa_lens.db").path

        guard FileManager.default.fileExists(atPath: dbPath) else {
            task.setTaskCompleted(success: true)
            return
        }

        // Full missed-dose notification logic mirrors NativeAlarmPlugin.
        // Reads reminders + dose_logs from the shared DB and posts local notifications
        // via UNUserNotificationCenter for any doses that were skipped.
        // Stub: mark complete — extend here when NativeAlarmPlugin logic is ported.
        task.setTaskCompleted(success: true)
    }

    @available(iOS 13.0, *)
    private func scheduleNextMissedDoseCheck() {
        let request = BGAppRefreshTaskRequest(
            identifier: "com.dawainnovation.lens.missed-dose-check"
        )
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        try? BGTaskScheduler.shared.submit(request)
    }

    // MARK: – URL / Activity handling

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
