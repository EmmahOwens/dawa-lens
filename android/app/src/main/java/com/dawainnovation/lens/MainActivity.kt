package com.dawainnovation.lens

import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import com.getcapacitor.BridgeActivity
import java.util.concurrent.TimeUnit

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // ✅ Install splash screen first
        try {
            installSplashScreen()
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to install splash screen", e)
        }

        // Support edge-to-edge display (Android 15+)
        enableEdgeToEdge()

        // Register plugins BEFORE super.onCreate if they need to be available during initialization
        // Note: Capacitor 6+ handles plugin registration differently but manual registration is still supported
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

        // Defensive check for bridge and webView
        val currentBridge = bridge ?: return
        val webView = currentBridge.webView ?: return

        // Predictive Back support
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

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
        try {
            bridge?.webView?.clearCache(true)
        } catch (e: Exception) {
            // ignore — WebView may already be destroyed
        }
        super.onDestroy()
    }
}
