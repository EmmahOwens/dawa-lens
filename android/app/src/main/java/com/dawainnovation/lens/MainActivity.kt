package com.dawainnovation.lens

import android.os.Bundle
import android.view.View
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import com.getcapacitor.BridgeActivity
import java.util.concurrent.TimeUnit
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // ✅ Install splash screen first
        installSplashScreen()

        // Support edge-to-edge display (Android 15+)
        enableEdgeToEdge()

        registerPlugin(AppUpdaterPlugin::class.java)
        registerPlugin(NativeOcrPlugin::class.java)
        registerPlugin(NativeAlarmPlugin::class.java)
        registerPlugin(NativeCameraPlugin::class.java)
        registerPlugin(NativeSearchPlugin::class.java)
        registerPlugin(NativeSqlitePlugin::class.java)
        registerPlugin(NativePdfPlugin::class.java)
        registerPlugin(NativeLocationPlugin::class.java)
        registerPlugin(NativeHapticsPlugin::class.java)
        registerPlugin(NativeListPlugin::class.java)
        registerPlugin(NativeNavigationPlugin::class.java)
        
        super.onCreate(savedInstanceState)

        // Predictive Back support
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (bridge.webView.canGoBack()) {
                    bridge.webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // Enqueue the missed-dose background checker (15-minute period).
        val missedDoseWork = PeriodicWorkRequest.Builder(
            MissedDoseWorker::class.java, 15, TimeUnit.MINUTES
        ).build()
        
        WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
            "missed_dose_check",
            ExistingPeriodicWorkPolicy.KEEP,
            missedDoseWork
        )

        val webView = bridge.webView

        // Promote the WebView to a hardware-accelerated GPU layer
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        val settings = webView.settings
        settings.domStorageEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        
        // Modern renderer priority policy
        try {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true)
        } catch (e: Exception) {
            // Fallback for older WebView versions if necessary
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            bridge.webView.clearCache(true)
        } catch (e: Exception) {
            // ignore — WebView may already be destroyed
        }
    }
}
