package com.dawainnovation.lens

import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import com.getcapacitor.BridgeActivity
import java.util.concurrent.TimeUnit

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Install Android 12+ splash screen first
        try {
            installSplashScreen()
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to install splash screen", e)
        }

        // True edge-to-edge display across Android 10–15+
        enableEdgeToEdge()

        // Register all native Kotlin & Rust-JNI plugins BEFORE super.onCreate
        registerPlugin(AppUpdaterPlugin::class.java)
        registerPlugin(NativeOcrPlugin::class.java)
        registerPlugin(NativeAlarmPlugin::class.java)
        registerPlugin(NativeCameraPlugin::class.java)
        registerPlugin(NativeSearchPlugin::class.java)
        registerPlugin(NativeSqlitePlugin::class.java)
        registerPlugin(NativePdfPlugin::class.java)
        registerPlugin(NativeLocationPlugin::class.java)
        registerPlugin(NativeHapticsPlugin::class.java)
        registerPlugin(NativeSoundPlugin::class.java)
        registerPlugin(NativeListPlugin::class.java)
        registerPlugin(NativeNavigationPlugin::class.java)

        super.onCreate(savedInstanceState)

        // Seamless edge-to-edge cutout & transparent system bar configuration
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
            window.isStatusBarContrastEnforced = false
        }

        // Displace bottom system navigation bar cleanly so 3-button nav never overlaps UI
        val rootView = findViewById<View>(android.R.id.content)
        if (rootView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(rootView) { view, windowInsets ->
                val insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.navigationBars() or WindowInsetsCompat.Type.displayCutout()
                )
                view.setPadding(insets.left, 0, insets.right, insets.bottom)
                windowInsets
            }
            ViewCompat.requestApplyInsets(rootView)
        }

        // Defensive check for bridge and webView
        val currentBridge = bridge ?: return
        val webView = currentBridge.webView ?: return

        // Enqueue the missed-dose background checker (15-minute period).
        try {
            val missedDoseWork = PeriodicWorkRequest.Builder(
                MissedDoseWorker::class.java, 15, TimeUnit.MINUTES
            ).build()

            WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
                "missed_dose_check",
                ExistingPeriodicWorkPolicy.KEEP,
                missedDoseWork
            )
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to enqueue WorkManager task", e)
        }

        // Promote the WebView to a hardware-accelerated GPU layer and remove browser chrome tells
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false
        webView.isHapticFeedbackEnabled = true

        val settings = webView.settings
        settings.domStorageEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        // Allow instantaneous audio cues without browser autoplay gesture blocks
        settings.mediaPlaybackRequiresUserGesture = false
        // Harden WebView against local file:// and content:// cross-origin disclosure
        settings.allowFileAccess = false
        settings.allowContentAccess = false

        // Keep WebView renderer at highest priority so Android LMK doesn't evict the UI process
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true)
            } catch (_: Exception) {
            }
        }
    }

    override fun onDestroy() {
        // Preserve WebView disk cache (keeps compiled V8 bytecode for fast subsequent starts).
        super.onDestroy()
    }
}
