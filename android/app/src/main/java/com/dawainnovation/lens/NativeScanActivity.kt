package com.dawainnovation.lens

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.os.Bundle
import android.util.Base64
import android.view.Gravity
import android.view.Surface
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageButton
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class NativeScanActivity : AppCompatActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var overlayView: ScanOverlayView
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private lateinit var cameraExecutor: ExecutorService
    private var lensFacing = CameraSelector.LENS_FACING_BACK
    private var flashEnabled = false
    private val scanMode by lazy { intent.getStringExtra("SCAN_MODE") ?: "pill" }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Build layout programmatically — avoids needing a layout XML resource
        val root = FrameLayout(this).also { setContentView(it) }

        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            implementationMode = PreviewView.ImplementationMode.PERFORMANCE
        }
        root.addView(previewView)

        overlayView = ScanOverlayView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        root.addView(overlayView)

        // Close button — top-left
        val closeBtn = ImageButton(this).apply {
            setImageDrawable(
                ContextCompat.getDrawable(context, android.R.drawable.ic_menu_close_clear_cancel)
            )
            setBackgroundColor(Color.TRANSPARENT)
            val p = 48
            setPadding(p, p, p, p)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).also {
                it.leftMargin = 32
                it.topMargin = 80
            }
        }
        closeBtn.setOnClickListener {
            setResult(Activity.RESULT_CANCELED)
            finish()
        }
        root.addView(closeBtn)

        // Flash toggle button — top-right
        val flashBtn = ImageButton(this).apply {
            setImageDrawable(
                ContextCompat.getDrawable(context, android.R.drawable.ic_menu_compass)
            )
            setBackgroundColor(Color.TRANSPARENT)
            val p = 48
            setPadding(p, p, p, p)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).also {
                it.gravity = Gravity.TOP or Gravity.END
                it.rightMargin = 32
                it.topMargin = 80
            }
        }
        flashBtn.setOnClickListener { toggleFlash() }
        root.addView(flashBtn)

        // Capture button — bottom-center
        val captureBtn = View(this).apply {
            background = ContextCompat.getDrawable(context, android.R.drawable.btn_default_small)
            val size = 200
            layoutParams = FrameLayout.LayoutParams(size, size).also {
                it.gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                it.bottomMargin = 120
            }
        }
        captureBtn.setOnClickListener { captureImage() }
        root.addView(captureBtn)

        cameraExecutor = Executors.newSingleThreadExecutor()
        startCamera()
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            val cameraSelector = CameraSelector.Builder()
                .requireLensFacing(lensFacing)
                .build()

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(
                    this, cameraSelector, preview, imageCapture
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun toggleFlash() {
        flashEnabled = !flashEnabled
        camera?.cameraControl?.enableTorch(flashEnabled)
    }

    private fun captureImage() {
        val capture = imageCapture ?: return
        capture.takePicture(cameraExecutor, object : ImageCapture.OnImageCapturedCallback() {
            override fun onCaptureSuccess(image: ImageProxy) {
                val bitmap = image.toBitmap()
                image.close()
                val processed = preprocessBitmap(bitmap)
                val out = ByteArrayOutputStream()
                processed.compress(Bitmap.CompressFormat.JPEG, 85, out)
                val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                val dataUrl = "data:image/jpeg;base64,$base64"
                runOnUiThread {
                    val result = Intent().putExtra("IMAGE_DATA", dataUrl)
                    setResult(Activity.RESULT_OK, result)
                    finish()
                }
            }

            override fun onError(exc: ImageCaptureException) {
                runOnUiThread {
                    setResult(Activity.RESULT_CANCELED)
                    finish()
                }
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }

    /**
     * Boosts contrast and brightness so text/markings on pills and packaging
     * are sharper before JPEG compression and OCR processing.
     * The original bitmap is recycled; callers must use the returned bitmap.
     */
    private fun preprocessBitmap(input: Bitmap): Bitmap {
        val output = Bitmap.createBitmap(input.width, input.height, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(output)
        val contrast  = 1.25f
        val translate = (-(0.5f * contrast) + 0.5f) * 255f + 8f
        val cm = android.graphics.ColorMatrix(floatArrayOf(
            contrast, 0f, 0f, 0f, translate,
            0f, contrast, 0f, 0f, translate,
            0f, 0f, contrast, 0f, translate,
            0f, 0f, 0f, 1f, 0f
        ))
        val paint = android.graphics.Paint().apply {
            colorFilter = android.graphics.ColorMatrixColorFilter(cm)
        }
        canvas.drawBitmap(input, 0f, 0f, paint)
        input.recycle()
        return output
    }
}

/**
 * Animated scan-area overlay drawn entirely on a Canvas:
 *  - Darkened mask outside the scan box (four rectangles)
 *  - Green corner brackets (L-shapes) at each corner
 *  - Scanning line that bounces top-to-bottom at ~60 fps via postInvalidateDelayed(16)
 *
 * The scan box is centered, square, and 85 % of the smaller screen dimension.
 */
class ScanOverlayView(context: Context) : View(context) {

    private val dimPaint = Paint().apply {
        color = Color.argb(140, 0, 0, 0)
    }

    private val bracketPaint = Paint().apply {
        color = Color.parseColor("#4CAF50") // Material Green 500
        style = Paint.Style.STROKE
        strokeWidth = 8f
        isAntiAlias = true
        strokeCap = Paint.Cap.SQUARE
    }

    private val linePaint = Paint().apply {
        color = Color.parseColor("#80C784") // Material Green 300 at ~75 % opacity
        strokeWidth = 4f
        isAntiAlias = true
    }

    // Scan-line state
    private var scanLineY = -1f        // -1 = not yet initialised
    private var scanLineDirection = 1f // +1 = moving downward
    private val bracketLength = 60f

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()
        if (w == 0f || h == 0f) return

        val boxSize = minOf(w, h) * 0.85f
        val left   = (w - boxSize) / 2f
        val top    = (h - boxSize) / 2f
        val right  = left + boxSize
        val bottom = top  + boxSize

        // --- Darkened mask outside the scan box (four rects; avoids PorterDuff) ---
        canvas.drawRect(0f,   0f,    w,    top,    dimPaint) // above
        canvas.drawRect(0f,   bottom, w,    h,      dimPaint) // below
        canvas.drawRect(0f,   top,   left, bottom, dimPaint) // left
        canvas.drawRect(right, top,   w,    bottom, dimPaint) // right

        // --- Corner brackets ---
        val bl = bracketLength
        // Top-left
        canvas.drawLine(left,        top + bl, left,        top,        bracketPaint)
        canvas.drawLine(left,        top,      left + bl,   top,        bracketPaint)
        // Top-right
        canvas.drawLine(right - bl,  top,      right,       top,        bracketPaint)
        canvas.drawLine(right,       top,      right,       top + bl,   bracketPaint)
        // Bottom-left
        canvas.drawLine(left,        bottom - bl, left,     bottom,     bracketPaint)
        canvas.drawLine(left,        bottom,   left + bl,   bottom,     bracketPaint)
        // Bottom-right
        canvas.drawLine(right - bl,  bottom,   right,       bottom,     bracketPaint)
        canvas.drawLine(right,       bottom - bl, right,    bottom,     bracketPaint)

        // --- Animated scan line ---
        // Initialise at the top of the scan box on the first draw
        if (scanLineY < 0f) scanLineY = top

        canvas.drawLine(left + 4f, scanLineY, right - 4f, scanLineY, linePaint)

        // Advance position and bounce at box edges
        scanLineY += scanLineDirection * 4f
        when {
            scanLineY >= bottom -> { scanLineY = bottom; scanLineDirection = -1f }
            scanLineY <= top    -> { scanLineY = top;    scanLineDirection =  1f }
        }

        // Schedule next frame at ~60 fps
        postInvalidateDelayed(16)
    }
}
