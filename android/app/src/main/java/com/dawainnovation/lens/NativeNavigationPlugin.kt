package com.dawainnovation.lens

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.WindowManager
import androidx.core.view.WindowCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Native Android System UI, Navigation, Performance Profiling & Intent Bridge.
 *
 * Bridges native Android capabilities that separate an installed Kotlin app from a wrapped
 * WebView:
 * - Dynamic light/dark status & navigation bar icon contrast + edge-to-edge bar tinting.
 * - Native `moveTaskToBack(true)` warm backgrounding on root Back press (0ms warm resume
 *   instead of cold-restarting the WebView process).
 * - Device refresh rate (60/90/120Hz), RAM tier (`isLowRamDevice`), and OS animator scale
 *   detection so WebView blur/animations adapt to real hardware.
 * - Direct native Google Maps (`google.navigation:` / `geo:`) Intent handoff without detouring
 *   through Chrome.
 */
@CapacitorPlugin(name = "NativeNavigation")
class NativeNavigationPlugin : Plugin() {

    @PluginMethod
    fun pushPage(call: PluginCall) {
        // Trigger a crisp native clock-tick haptic on route push if requested
        val haptic = call.getBoolean("haptic", false) ?: false
        if (haptic) {
            activity?.runOnUiThread {
                try {
                    bridge?.webView?.performHapticFeedback(
                        android.view.HapticFeedbackConstants.CLOCK_TICK
                    )
                } catch (_: Exception) {
                }
            }
        }
        call.resolve()
    }

    /**
     * Synchronizes Android status bar and navigation bar icon contrast and tint with the
     * active Light / Dark / Adaptive Mood theme.
     */
    @PluginMethod
    fun setSystemBarsStyle(call: PluginCall) {
        val isDark = call.getBoolean("isDark", false) ?: false
        val statusBarHex = call.getString("statusBarColor")
        val navBarHex = call.getString("navigationBarColor")

        val act = activity
        if (act == null) {
            call.resolve()
            return
        }

        act.runOnUiThread {
            try {
                val window = act.window
                val controller = WindowCompat.getInsetsController(window, window.decorView)
                controller.isAppearanceLightStatusBars = !isDark
                controller.isAppearanceLightNavigationBars = !isDark

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    window.isNavigationBarContrastEnforced = false
                    window.isStatusBarContrastEnforced = false
                }

                @Suppress("DEPRECATION")
                if (!statusBarHex.isNullOrBlank()) {
                    try {
                        window.statusBarColor = Color.parseColor(statusBarHex)
                    } catch (_: IllegalArgumentException) {
                    }
                }

                @Suppress("DEPRECATION")
                if (!navBarHex.isNullOrBlank()) {
                    try {
                        window.navigationBarColor = Color.parseColor(navBarHex)
                    } catch (_: IllegalArgumentException) {
                    }
                }
            } catch (_: Exception) {
            }
            call.resolve()
        }
    }

    /**
     * Moves the app task to the background (like native Android Kotlin apps) instead of
     * destroying the Activity/WebView process, making subsequent app opens instantaneous.
     */
    @PluginMethod
    fun moveToBackground(call: PluginCall) {
        val act = activity
        if (act == null) {
            call.resolve(JSObject().apply { put("moved", false) })
            return
        }
        act.runOnUiThread {
            val moved = try {
                act.moveTaskToBack(true)
            } catch (_: Exception) {
                false
            }
            call.resolve(JSObject().apply { put("moved", moved) })
        }
    }

    /**
     * Reports hardware display refresh rate, RAM class, and OS animator duration scale so
     * frontend motion and glassmorphism stay locked inside the real device frame budget.
     */
    @PluginMethod
    fun getDevicePerformanceProfile(call: PluginCall) {
        try {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            val isLowRam = am?.isLowRamDevice ?: false
            val memoryClassMb = am?.memoryClass ?: 256

            val refreshRate = try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    activity?.display?.refreshRate ?: 60f
                } else {
                    @Suppress("DEPRECATION")
                    val wm = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
                    @Suppress("DEPRECATION")
                    wm?.defaultDisplay?.refreshRate ?: 60f
                }
            } catch (_: Exception) {
                60f
            }

            val animatorScale = try {
                Settings.Global.getFloat(
                    context.contentResolver,
                    Settings.Global.ANIMATOR_DURATION_SCALE,
                    1.0f
                )
            } catch (_: Exception) {
                1.0f
            }

            val res = JSObject().apply {
                put("refreshRateHz", refreshRate.toDouble())
                put("isLowRamDevice", isLowRam || memoryClassMb <= 192)
                put("memoryClassMb", memoryClassMb)
                put("sdkInt", Build.VERSION.SDK_INT)
                put("animatorDurationScale", animatorScale.toDouble())
                put("reducedMotion", animatorScale == 0f)
            }
            call.resolve(res)
        } catch (e: Exception) {
            call.resolve(JSObject().apply {
                put("refreshRateHz", 60.0)
                put("isLowRamDevice", false)
                put("memoryClassMb", 256)
                put("sdkInt", Build.VERSION.SDK_INT)
                put("animatorDurationScale", 1.0)
                put("reducedMotion", false)
            })
        }
    }

    /**
     * Launches turn-by-turn navigation directly in the native Google Maps / default Maps app
     * via Android `google.navigation:` / `geo:` Intents instead of opening Chrome.
     */
    @PluginMethod
    fun openNativeMaps(call: PluginCall) {
        val lat = call.getDouble("lat")
        val lng = call.getDouble("lng")
        if (lat == null || lng == null || !lat.isFinite() || !lng.isFinite()) {
            call.reject("Valid lat and lng are required")
            return
        }
        val label = call.getString("label") ?: ""
        val mode = call.getString("mode") ?: "driving"
        val fallbackUrl = call.getString("fallbackUrl")

        val act = activity ?: run {
            call.resolve(JSObject().apply { put("opened", false) })
            return
        }

        val googleMode = when (mode) {
            "walking" -> "w"
            "boda_boda" -> "l" // two-wheeler in Google Maps navigation URI
            else -> "d"
        }

        act.runOnUiThread {
            try {
                // 1. Direct Google Maps turn-by-turn navigation intent
                val navUri = Uri.parse("google.navigation:q=$lat,$lng&mode=$googleMode")
                val gmapsIntent = Intent(Intent.ACTION_VIEW, navUri).apply {
                    setPackage("com.google.android.apps.maps")
                }
                if (gmapsIntent.resolveActivity(act.packageManager) != null) {
                    act.startActivity(gmapsIntent)
                    call.resolve(JSObject().apply { put("opened", true); put("target", "google_maps") })
                    return@runOnUiThread
                }

                // 2. Generic native geo: URI for any installed map app (OsmAnd, Organic Maps, Waze, etc.)
                val encodedLabel = Uri.encode(label)
                val geoUri = if (encodedLabel.isNotEmpty()) {
                    Uri.parse("geo:$lat,$lng?q=$lat,$lng($encodedLabel)")
                } else {
                    Uri.parse("geo:$lat,$lng?q=$lat,$lng")
                }
                val geoIntent = Intent(Intent.ACTION_VIEW, geoUri)
                if (geoIntent.resolveActivity(act.packageManager) != null) {
                    act.startActivity(geoIntent)
                    call.resolve(JSObject().apply { put("opened", true); put("target", "geo_intent") })
                    return@runOnUiThread
                }

                // 3. Fallback to HTTPS directions URL if no map app is installed
                if (!fallbackUrl.isNullOrBlank()) {
                    act.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)))
                    call.resolve(JSObject().apply { put("opened", true); put("target", "browser") })
                    return@runOnUiThread
                }

                call.resolve(JSObject().apply { put("opened", false) })
            } catch (_: Exception) {
                call.resolve(JSObject().apply { put("opened", false) })
            }
        }
    }
}
