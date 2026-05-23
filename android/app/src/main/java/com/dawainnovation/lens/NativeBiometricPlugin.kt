package com.dawainnovation.lens

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativeBiometric")
class NativeBiometricPlugin : Plugin() {

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val manager = BiometricManager.from(context)
        val result = JSObject()
        when (manager.canAuthenticate(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                result.put("available", true)
                // Distinguish biometric hardware type
                val type = when {
                    manager.canAuthenticate(BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS -> "fingerprint"
                    else -> "device_credential"
                }
                result.put("biometryType", type)
                call.resolve(result)
            }
            else -> {
                result.put("available", false)
                result.put("biometryType", "none")
                call.resolve(result)
            }
        }
    }

    @PluginMethod
    fun authenticate(call: PluginCall) {
        val reason = call.getString("reason") ?: "Verify your identity"
        @Suppress("UNUSED_VARIABLE")
        val fallbackTitle = call.getString("fallbackTitle") ?: "Use Passcode"

        // BiometricPrompt MUST be constructed and shown on the UI thread
        // from a FragmentActivity — Capacitor's `activity` is AppCompatActivity (a FragmentActivity).
        activity.runOnUiThread {
            val executor = ContextCompat.getMainExecutor(context)

            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    val res = JSObject()
                    res.put("success", true)
                    call.resolve(res)
                }

                override fun onAuthenticationFailed() {
                    // User attempted but biometric did not match — let them retry;
                    // do NOT resolve yet.
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    // Resolve (not reject) so JS can handle errors gracefully
                    // (e.g. user cancelled, lockout, no hardware).
                    val res = JSObject()
                    res.put("success", false)
                    res.put("error", errString.toString())
                    call.resolve(res)
                }
            }

            val prompt = BiometricPrompt(activity, executor, callback)
            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Dawa Lens")
                .setSubtitle(reason)
                // DEVICE_CREDENTIAL allows PIN/pattern/password as fallback;
                // setNegativeButtonText must NOT be set when using DEVICE_CREDENTIAL.
                .setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
                .build()

            prompt.authenticate(info)
        }
    }
}
