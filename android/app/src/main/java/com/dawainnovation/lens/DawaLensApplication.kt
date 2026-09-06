package com.dawainnovation.lens

import android.app.Application
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import app.rive.runtime.kotlin.core.Rive

class DawaLensApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize Rive with error handling to prevent crash if native libs are missing
        try {
            Rive.init(this)
        } catch (e: Throwable) {
            Log.e("DawaLensApplication", "Failed to initialize Rive runtime", e)
        }

        // Auto-start the AdherenceGuardianService on aggressive OEM devices.
        // Application.onCreate() is the earliest entry point when the OS restores
        // the app process after a force-stop, reboot, or swipe-kill recovery.
        autoStartGuardianIfNeeded()
    }

    /**
     * Auto-starts the AdherenceGuardianService on devices from manufacturers known to
     * aggressively kill background processes. This ensures the foreground service (and its
     * upcoming alarm countdown notification) are active as early as possible.
     */
    private fun autoStartGuardianIfNeeded() {
        if (AdherenceGuardianService.isRunning) return

        val m = Build.MANUFACTURER.lowercase()
        val b = Build.BRAND.lowercase()
        val isAggressiveOem = m.contains("transsion") || m.contains("infinix") ||
            m.contains("tecno") || m.contains("itel") || b.contains("infinix") || b.contains("tecno") ||
            m.contains("xiaomi") || m.contains("redmi") || m.contains("poco") ||
            b.contains("xiaomi") || b.contains("redmi") || b.contains("poco") ||
            m.contains("samsung") ||
            m.contains("huawei") || m.contains("honor") || b.contains("huawei") || b.contains("honor") ||
            m.contains("oppo") || m.contains("realme") || b.contains("realme") ||
            m.contains("oneplus") || b.contains("oneplus") ||
            m.contains("vivo") || m.contains("iqoo") || b.contains("vivo") || b.contains("iqoo")

        if (isAggressiveOem) {
            try {
                val intent = Intent(this, AdherenceGuardianService::class.java).apply {
                    action = AdherenceGuardianService.ACTION_START
                }
                ContextCompat.startForegroundService(this, intent)
            } catch (e: Exception) {
                Log.w("DawaLensApplication", "Failed to auto-start Guardian service", e)
            }
        }
    }
}
