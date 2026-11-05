package com.dawainnovation.lens

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * High-performance, security-hardened On-Device ML Kit OCR Plugin.
 *
 * Security & Performance Controls:
 * - Offloads Base64 decoding and Bitmap allocation onto a bounded single-thread executor so
 *   the Android UI / WebView main thread never drops frames.
 * - Rejects arbitrary file/content URI paths over the WebView bridge (preventing local file
 *   traversal or content-provider confused-deputy reads).
 * - Enforces strict payload byte limits (`MAX_BASE64_CHARS`) and `inJustDecodeBounds` dimension
 *   checks + `inSampleSize` downsampling to prevent decompression-bomb OOM crashes.
 */
@CapacitorPlugin(name = "NativeOcr")
class NativeOcrPlugin : Plugin() {

    companion object {
        private const val MAX_BASE64_CHARS = 10 * 1024 * 1024 // ~7.5 MB max image payload
        private const val MAX_SOURCE_DIMENSION = 8192
        private const val MAX_TARGET_DIMENSION = 2048
    }

    private val ocrExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    private val recognizer: TextRecognizer by lazy {
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }

    @PluginMethod
    fun recognizeText(call: PluginCall) {
        val imageData = call.getString("imageData") ?: run {
            call.reject("imageData is required")
            return
        }

        val base64Data = if (imageData.contains(",")) imageData.substringAfter(",") else imageData
        if (base64Data.isBlank() || base64Data.length > MAX_BASE64_CHARS) {
            call.reject("Image data is empty or exceeds maximum allowed size")
            return
        }

        ocrExecutor.execute {
            try {
                val bytes = try {
                    Base64.decode(base64Data, Base64.DEFAULT)
                } catch (e: IllegalArgumentException) {
                    call.reject("Invalid base64 image data", e)
                    return@execute
                }

                // 1. Probe dimensions without allocating pixel memory (prevents decompression bombs)
                val boundsOpts = BitmapFactory.Options().apply {
                    inJustDecodeBounds = true
                }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, boundsOpts)
                val srcW = boundsOpts.outWidth
                val srcH = boundsOpts.outHeight
                if (srcW <= 0 || srcH <= 0 || srcW > MAX_SOURCE_DIMENSION || srcH > MAX_SOURCE_DIMENSION) {
                    call.reject("Invalid or unsupported image dimensions")
                    return@execute
                }

                // 2. Compute power-of-two subsampling if image exceeds MAX_TARGET_DIMENSION
                var sampleSize = 1
                while ((srcW / sampleSize) > MAX_TARGET_DIMENSION || (srcH / sampleSize) > MAX_TARGET_DIMENSION) {
                    sampleSize *= 2
                }

                val decodeOpts = BitmapFactory.Options().apply {
                    inSampleSize = sampleSize
                    inPreferredConfig = Bitmap.Config.ARGB_8888
                }
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOpts) ?: run {
                    call.reject("Failed to decode image bitmap")
                    return@execute
                }

                val inputImage = InputImage.fromBitmap(bitmap, 0)
                recognizer.process(inputImage)
                    .addOnSuccessListener { visionText ->
                        val result = JSObject()
                        result.put("text", visionText.text)
                        call.resolve(result)
                    }
                    .addOnFailureListener { e ->
                        call.reject("Text recognition failed", e)
                    }
            } catch (e: Exception) {
                call.reject("OCR pipeline failed: ${e.message}", e)
            }
        }
    }

    override fun handleOnDestroy() {
        try {
            recognizer.close()
        } catch (_: Exception) {
        }
        ocrExecutor.shutdown()
        super.handleOnDestroy()
    }
}
