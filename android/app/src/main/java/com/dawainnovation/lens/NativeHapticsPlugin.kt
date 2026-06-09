package com.dawainnovation.lens

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativeHaptics")
class NativeHapticsPlugin : Plugin() {

    private val vibrator: Vibrator by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    @PluginMethod
    fun impact(call: PluginCall) {
        val style = call.getString("style") ?: "medium"
        
        val effect = when (style) {
            "light" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
            "heavy" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
            else -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
        }
        
        vibrator.vibrate(effect)
        call.resolve()
    }

    @PluginMethod
    fun notification(call: PluginCall) {
        val type = call.getString("type") ?: "success"
        
        when (type) {
            "success" -> {
                val timings = longArrayOf(0, 40, 40, 40)
                val amplitudes = intArrayOf(0, 100, 0, 150)
                vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
            }
            "warning" -> {
                val timings = longArrayOf(0, 100, 40, 100)
                val amplitudes = intArrayOf(0, 200, 0, 200)
                vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
            }
            "error" -> {
                val timings = longArrayOf(0, 50, 40, 50, 40, 50, 40, 150)
                val amplitudes = intArrayOf(0, 150, 0, 150, 0, 150, 0, 255)
                vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
            }
        }
        call.resolve()
    }
}
