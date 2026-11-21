package com.dawainnovation.lens

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.HapticFeedbackConstants
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Low-latency Native Android Haptics Plugin.
 *
 * Prioritizes Android's hardware LRA `View.performHapticFeedback(HapticFeedbackConstants.*)`
 * pipeline so micro-interactions (taps, switches, tab switches, sheet detents, confirmations)
 * match native Kotlin apps in crispness and automatically honor Android's system Touch Feedback
 * setting, with `VibrationEffect.createPredefined(...)` fallback for rich waveforms.
 */
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

    private fun performViewHaptic(constant: Int): Boolean {
        return try {
            val view = bridge?.webView ?: activity?.window?.decorView ?: return false
            var performed = false
            if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
                performed = view.performHapticFeedback(constant)
            } else {
                view.post {
                    try {
                        view.performHapticFeedback(constant)
                    } catch (_: Exception) {
                    }
                }
                performed = true
            }
            performed
        } catch (_: Exception) {
            false
        }
    }

    @PluginMethod
    fun impact(call: PluginCall) {
        val style = call.getString("style") ?: "medium"
        try {
            val handledByView = when (style) {
                "light" -> performViewHaptic(HapticFeedbackConstants.CLOCK_TICK)
                "heavy" -> performViewHaptic(HapticFeedbackConstants.LONG_PRESS)
                else -> {
                    val constant = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        HapticFeedbackConstants.CONTEXT_CLICK
                    } else {
                        HapticFeedbackConstants.VIRTUAL_KEY
                    }
                    performViewHaptic(constant)
                }
            }

            if (!handledByView) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val effect = when (style) {
                        "light" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
                        "heavy" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
                        else -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                    }
                    vibrator.vibrate(effect)
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val duration = when (style) {
                        "light" -> 12L
                        "heavy" -> 35L
                        else -> 20L
                    }
                    vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(20L)
                }
            }
        } catch (_: Exception) {
            // Ignore vibration errors gracefully
        }
        call.resolve()
    }

    /**
     * Single-call crisp selection tick for switches, segmented controls, pickers, and tab changes.
     * Replaces 3 sequential bridge calls (selectionStart/Changed/End) with one sub-ms native tick.
     */
    @PluginMethod
    fun selection(call: PluginCall) {
        try {
            val constant = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                HapticFeedbackConstants.SEGMENT_TICK
            } else {
                HapticFeedbackConstants.CLOCK_TICK
            }
            if (!performViewHaptic(constant) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK))
            }
        } catch (_: Exception) {
        }
        call.resolve()
    }

    @PluginMethod
    fun gesture(call: PluginCall) {
        val phase = call.getString("phase") ?: "start"
        try {
            val constant = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (phase == "end") HapticFeedbackConstants.GESTURE_END else HapticFeedbackConstants.GESTURE_START
            } else {
                HapticFeedbackConstants.CLOCK_TICK
            }
            performViewHaptic(constant)
        } catch (_: Exception) {
        }
        call.resolve()
    }

    @PluginMethod
    fun notification(call: PluginCall) {
        try {
            val type = call.getString("type") ?: "success"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val handled = when (type) {
                    "success" -> performViewHaptic(HapticFeedbackConstants.CONFIRM)
                    "error" -> performViewHaptic(HapticFeedbackConstants.REJECT)
                    else -> false
                }
                if (handled) {
                    call.resolve()
                    return
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && type == "success") {
                vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK))
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                when (type) {
                    "success" -> {
                        val timings = longArrayOf(0, 25, 45, 35)
                        val amplitudes = intArrayOf(0, 120, 0, 180)
                        vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
                    }
                    "warning" -> {
                        val timings = longArrayOf(0, 55, 45, 55)
                        val amplitudes = intArrayOf(0, 190, 0, 190)
                        vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
                    }
                    "error" -> {
                        val timings = longArrayOf(0, 35, 35, 35, 35, 80)
                        val amplitudes = intArrayOf(0, 170, 0, 170, 0, 240)
                        vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
                    }
                }
            } else {
                @Suppress("DEPRECATION")
                when (type) {
                    "success" -> vibrator.vibrate(longArrayOf(0, 25, 45, 35), -1)
                    "warning" -> vibrator.vibrate(longArrayOf(0, 55, 45, 55), -1)
                    "error" -> vibrator.vibrate(longArrayOf(0, 35, 35, 35, 35, 80), -1)
                }
            }
        } catch (_: Exception) {
            // Ignore vibration errors gracefully
        }
        call.resolve()
    }
}
