package com.dawainnovation.lens

import android.app.Application
import app.rive.runtime.kotlin.core.Rive

class DawaLensApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize Rive
        Rive.init(this)
    }
}
