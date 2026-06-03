package com.dawainnovation.lens

import android.app.Application
import android.util.Log
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
    }
}
