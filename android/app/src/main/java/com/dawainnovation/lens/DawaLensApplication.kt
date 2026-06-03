package com.dawainnovation.lens

import android.app.Application
import app.rive.runtime.kotlin.RiveInitializer

class DawaLensApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize Rive
        RiveInitializer.initializer(this)
    }
}
