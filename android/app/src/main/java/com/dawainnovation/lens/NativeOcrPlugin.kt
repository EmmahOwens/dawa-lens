package com.dawainnovation.lens

import android.graphics.BitmapFactory
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

@CapacitorPlugin(name = "NativeOcr")
class NativeOcrPlugin : Plugin() {

    @PluginMethod
    fun recognizeText(call: PluginCall) {
        val imageData = call.getString("imageData") ?: run {
            call.reject("imageData is required")
            return
        }

        // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,")
        val base64Data = if (imageData.contains(",")) imageData.substringAfter(",") else imageData

        val bytes = try {
            Base64.decode(base64Data, Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            call.reject("Invalid base64 image data", e)
            return
        }

        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: run {
            call.reject("Failed to decode image bitmap")
            return
        }

        val image = InputImage.fromBitmap(bitmap, 0)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                val result = JSObject()
                result.put("text", visionText.text)
                call.resolve(result)
            }
            .addOnFailureListener { e ->
                call.reject("Text recognition failed", e)
            }
    }
}
