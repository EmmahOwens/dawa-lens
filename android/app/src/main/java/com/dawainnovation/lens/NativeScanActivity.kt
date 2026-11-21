package com.dawainnovation.lens

import android.Manifest
import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.os.Bundle
import android.util.Base64
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.google.common.util.concurrent.ListenableFuture
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Native Kotlin CameraX Pill & Label Scanner Activity.
 *
 * Designed to feel indistinguishable from a flagship native Android camera experience:
 * - Hardware-accelerated `PreviewView.ImplementationMode.PERFORMANCE` SurfaceView.
 * - VSync-synchronized `ValueAnimator` laser scan line (smooth at 60/90/120Hz) with zero
 *   per-frame allocations in `onDraw`.
 * - Tap-to-focus with animated focus reticle + pinch-to-zoom via `ScaleGestureDetector`.
 * - Crisp custom-drawn circular glass controls (close, flash toggle with active amber glow,
 *   camera flip) and a tactile circular shutter button with press feedback + shutter flash.
 * - Proper EXIF rotation normalization from `ImageProxy.imageInfo.rotationDegrees`.
 */
class NativeScanActivity : AppCompatActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var overlayView: ScanOverlayView
    private lateinit var flashButton: CircularIconView
    private lateinit var shutterButton: ShutterButtonView
    private lateinit var shutterFlashOverlay: View
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private lateinit var cameraExecutor: ExecutorService
    private var lensFacing = CameraSelector.LENS_FACING_BACK
    private var flashEnabled = false
    private var isCapturing = false
    private val scanMode by lazy { intent.getStringExtra("SCAN_MODE") ?: "pill" }

    companion object {
        private const val RC_CAMERA_PERMISSION = 1001
    }

    private fun dp(value: Float): Int = (value * resources.displayMetrics.density).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Pre-warm CameraX immediately while building views
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
        }
        setContentView(root)

        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            implementationMode = PreviewView.ImplementationMode.PERFORMANCE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
        root.addView(previewView)

        overlayView = ScanOverlayView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        root.addView(overlayView)

        // Pinch-to-zoom + Tap-to-focus gesture handling on preview
        val scaleDetector = ScaleGestureDetector(
            this,
            object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
                override fun onScale(detector: ScaleGestureDetector): Boolean {
                    val cam = camera ?: return false
                    val currentRatio = cam.cameraInfo.zoomState.value?.zoomRatio ?: 1f
                    cam.cameraControl.setZoomRatio(currentRatio * detector.scaleFactor)
                    return true
                }
            }
        )

        previewView.setOnTouchListener { view, event ->
            scaleDetector.onTouchEvent(event)
            if (event.action == MotionEvent.ACTION_UP && !scaleDetector.isInProgress) {
                val point = previewView.meteringPointFactory.createPoint(event.x, event.y)
                val action = FocusMeteringAction.Builder(point, FocusMeteringAction.FLAG_AF)
                    .setAutoCancelDuration(3, TimeUnit.SECONDS)
                    .build()
                camera?.cameraControl?.startFocusAndMetering(action)
                overlayView.showFocusRing(event.x, event.y)
                view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                view.performClick()
            }
            true
        }

        // Top controls container (respects display cutout & status bar insets)
        val topBar = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP
            )
            setPadding(dp(20f), dp(16f), dp(20f), dp(12f))
        }

        val closeBtn = CircularIconView(this, CircularIconView.IconType.CLOSE).apply {
            contentDescription = "Close scanner"
            layoutParams = FrameLayout.LayoutParams(dp(44f), dp(44f), Gravity.START or Gravity.CENTER_VERTICAL)
            setOnClickListener {
                it.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                setResult(Activity.RESULT_CANCELED)
                finish()
            }
        }
        topBar.addView(closeBtn)

        val modeBadge = TextView(this).apply {
            text = if (scanMode == "text") "LABEL SCAN" else "PILL SCAN"
            setTextColor(Color.WHITE)
            textSize = 11f
            letterSpacing = 0.14f
            gravity = Gravity.CENTER
            setPadding(dp(16f), dp(9f), dp(16f), dp(9f))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(Color.argb(120, 20, 24, 32))
                cornerRadius = dp(24f).toFloat()
                setStroke(dp(1f), Color.argb(45, 255, 255, 255))
            }
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
        }
        topBar.addView(modeBadge)

        flashButton = CircularIconView(this, CircularIconView.IconType.FLASH).apply {
            contentDescription = "Toggle flashlight"
            layoutParams = FrameLayout.LayoutParams(dp(44f), dp(44f), Gravity.END or Gravity.CENTER_VERTICAL)
            setOnClickListener {
                it.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                toggleFlash()
            }
        }
        topBar.addView(flashButton)
        root.addView(topBar)

        // Bottom controls container (shutter + flip camera)
        val bottomBar = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            )
            setPadding(dp(28f), dp(20f), dp(28f), dp(28f))
        }

        shutterButton = ShutterButtonView(this).apply {
            contentDescription = "Capture medicine photo"
            layoutParams = FrameLayout.LayoutParams(dp(80f), dp(80f), Gravity.CENTER)
            setOnClickListener {
                if (!isCapturing) {
                    it.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                    captureImage()
                }
            }
        }
        bottomBar.addView(shutterButton)

        val flipBtn = CircularIconView(this, CircularIconView.IconType.FLIP).apply {
            contentDescription = "Switch camera"
            layoutParams = FrameLayout.LayoutParams(dp(48f), dp(48f), Gravity.END or Gravity.CENTER_VERTICAL)
            setOnClickListener {
                it.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
                    CameraSelector.LENS_FACING_FRONT
                } else {
                    CameraSelector.LENS_FACING_BACK
                }
                flashEnabled = false
                flashButton.setActive(false)
                startCamera()
            }
        }
        bottomBar.addView(flipBtn)
        root.addView(bottomBar)

        // Shutter white-flash feedback layer
        shutterFlashOverlay = View(this).apply {
            setBackgroundColor(Color.WHITE)
            alpha = 0f
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            isClickable = false
            isFocusable = false
        }
        root.addView(shutterFlashOverlay)

        // Apply real system bar & notch insets dynamically
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            topBar.setPadding(dp(20f), bars.top + dp(12f), dp(20f), dp(12f))
            bottomBar.setPadding(dp(28f), dp(16f), dp(28f), bars.bottom + dp(24f))
            insets
        }
        ViewCompat.requestApplyInsets(root)

        cameraExecutor = Executors.newSingleThreadExecutor()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            startCamera(cameraProviderFuture)
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CAMERA),
                RC_CAMERA_PERMISSION
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == RC_CAMERA_PERMISSION) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startCamera()
            } else {
                setResult(Activity.RESULT_CANCELED)
                finish()
            }
        }
    }

    private fun startCamera(future: ListenableFuture<ProcessCameraProvider> = ProcessCameraProvider.getInstance(this)) {
        future.addListener({
            val cameraProvider = future.get()

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
        flashButton.setActive(flashEnabled)
    }

    private fun triggerShutterFlash() {
        shutterFlashOverlay.alpha = 0.72f
        shutterFlashOverlay.animate()
            .alpha(0f)
            .setDuration(220L)
            .setInterpolator(DecelerateInterpolator())
            .start()
    }

    private fun captureImage() {
        val capture = imageCapture ?: return
        isCapturing = true
        shutterButton.isEnabled = false
        triggerShutterFlash()

        capture.takePicture(cameraExecutor, object : ImageCapture.OnImageCapturedCallback() {
            override fun onCaptureSuccess(image: ImageProxy) {
                try {
                    val rotationDegrees = image.imageInfo.rotationDegrees
                    val bitmap = image.toBitmap(rotationDegrees)
                    image.close()
                    if (bitmap != null) {
                        val processed = preprocessBitmap(bitmap)
                        val out = ByteArrayOutputStream(163840)
                        processed.compress(Bitmap.CompressFormat.JPEG, 82, out)
                        processed.recycle()
                        val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                        val dataUrl = "data:image/jpeg;base64,$base64"
                        runOnUiThread {
                            val result = Intent().putExtra("IMAGE_DATA", dataUrl)
                            setResult(Activity.RESULT_OK, result)
                            finish()
                        }
                    } else {
                        runOnUiThread {
                            setResult(Activity.RESULT_CANCELED)
                            finish()
                        }
                    }
                } catch (_: Exception) {
                    try { image.close() } catch (_: Exception) {}
                    runOnUiThread {
                        setResult(Activity.RESULT_CANCELED)
                        finish()
                    }
                }
            }

            override fun onError(exc: ImageCaptureException) {
                runOnUiThread {
                    isCapturing = false
                    shutterButton.isEnabled = true
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

    private fun preprocessBitmap(input: Bitmap): Bitmap {
        val maxDim = 1280
        val inW = input.width
        val inH = input.height
        val scale = if (inW > maxDim || inH > maxDim) {
            maxDim.toFloat() / maxOf(inW, inH).toFloat()
        } else {
            1f
        }
        val outW = (inW * scale).toInt().coerceAtLeast(1)
        val outH = (inH * scale).toInt().coerceAtLeast(1)

        val output = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val contrast = 1.2f
        val translate = (-(0.5f * contrast) + 0.5f) * 255f + 6f
        val cm = ColorMatrix(
            floatArrayOf(
                contrast, 0f, 0f, 0f, translate,
                0f, contrast, 0f, 0f, translate,
                0f, 0f, contrast, 0f, translate,
                0f, 0f, 0f, 1f, 0f
            )
        )
        val paint = Paint(Paint.FILTER_BITMAP_FLAG).apply {
            colorFilter = ColorMatrixColorFilter(cm)
        }
        canvas.drawBitmap(input, null, Rect(0, 0, outW, outH), paint)
        input.recycle()
        return output
    }
}

/**
 * Crisp native circular camera shutter button with instant press-scale feedback.
 */
private class ShutterButtonView(context: Context) : View(context) {
    private val density = context.resources.displayMetrics.density
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(140, 255, 255, 255)
        style = Paint.Style.STROKE
        strokeWidth = 4f * density
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.FILL
    }
    private var pressedFactor = 1f

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                pressedFactor = 0.88f
                invalidate()
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                pressedFactor = 1f
                invalidate()
            }
        }
        return super.onTouchEvent(event)
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val outerR = minOf(cx, cy) - ringPaint.strokeWidth / 2f - 2f
        canvas.drawCircle(cx, cy, outerR, ringPaint)
        canvas.drawCircle(cx, cy, (outerR - 6f * density) * pressedFactor, fillPaint)
    }
}

/**
 * Custom vector-drawn circular glass icon button (Close, Flash, Flip) so scanner controls
 * never depend on dated stock Android Holo drawables.
 */
private class CircularIconView(
    context: Context,
    private val iconType: IconType
) : View(context) {

    enum class IconType { CLOSE, FLASH, FLIP }

    private val density = context.resources.displayMetrics.density
    private var isActive = false

    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(120, 20, 24, 32)
        style = Paint.Style.FILL
    }
    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(48, 255, 255, 255)
        style = Paint.Style.STROKE
        strokeWidth = 1f * density
    }
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 2.2f * density
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val iconPath = Path()
    private val arcRect = RectF()

    fun setActive(active: Boolean) {
        isActive = active
        bgPaint.color = if (active) Color.parseColor("#007AFF") else Color.argb(120, 20, 24, 32)
        invalidate()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> animate().scaleX(0.92f).scaleY(0.92f).setDuration(90L).start()
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> animate().scaleX(1f).scaleY(1f).setDuration(120L).start()
        }
        return super.onTouchEvent(event)
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val r = minOf(cx, cy) - density
        canvas.drawCircle(cx, cy, r, bgPaint)
        canvas.drawCircle(cx, cy, r, borderPaint)

        val s = 7.5f * density
        when (iconType) {
            IconType.CLOSE -> {
                canvas.drawLine(cx - s, cy - s, cx + s, cy + s, strokePaint)
                canvas.drawLine(cx + s, cy - s, cx - s, cy + s, strokePaint)
            }
            IconType.FLASH -> {
                iconPath.reset()
                iconPath.moveTo(cx + 1.5f * density, cy - s * 1.15f)
                iconPath.lineTo(cx - s * 0.7f, cy + 1f * density)
                iconPath.lineTo(cx + 0.5f * density, cy + 1f * density)
                iconPath.lineTo(cx - 1.5f * density, cy + s * 1.15f)
                iconPath.lineTo(cx + s * 0.7f, cy - 1f * density)
                iconPath.lineTo(cx - 0.5f * density, cy - 1f * density)
                iconPath.close()
                strokePaint.style = if (isActive) Paint.Style.FILL_AND_STROKE else Paint.Style.STROKE
                canvas.drawPath(iconPath, strokePaint)
                strokePaint.style = Paint.Style.STROKE
            }
            IconType.FLIP -> {
                arcRect.set(cx - s, cy - s, cx + s, cy + s)
                canvas.drawArc(arcRect, -30f, 150f, false, strokePaint)
                canvas.drawArc(arcRect, 150f, 150f, false, strokePaint)
            }
        }
    }
}

/**
 * VSync-synchronized, zero-allocation scan-area overlay with rounded brackets,
 * glowing laser line, and animated tap-to-focus reticle.
 */
class ScanOverlayView(context: Context) : View(context) {

    private val density = context.resources.displayMetrics.density

    private val dimPaint = Paint().apply {
        color = Color.argb(145, 0, 0, 0)
    }

    private val bracketPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#2997FF")
        style = Paint.Style.STROKE
        strokeWidth = 3.5f * density
        strokeCap = Paint.Cap.ROUND
    }

    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeWidth = 2.5f * density
    }

    private val focusPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 2f * density
    }

    // Reusable RectFs and cached Shader to ensure zero GC allocations during 120Hz draws
    private val tlArc = RectF()
    private val trArc = RectF()
    private val blArc = RectF()
    private val brArc = RectF()

    private val bracketLength = 34f * density
    private val cornerRadius = 22f * density
    private val lineInset = 12f * density

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w <= 0 || h <= 0) return
        val boxSize = minOf(w.toFloat(), h.toFloat()) * 0.80f
        val left = (w - boxSize) / 2f
        val right = left + boxSize
        linePaint.shader = LinearGradient(
            left + lineInset, 0f, right - lineInset, 0f,
            intArrayOf(Color.TRANSPARENT, Color.parseColor("#2997FF"), Color.TRANSPARENT),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
    }

    private var scanProgress = 0f
    private var scanAnimator: ValueAnimator? = null

    private var focusX = -1f
    private var focusY = -1f
    private var focusAlpha = 0
    private var focusRadius = 32f * density
    private var focusAnimator: ValueAnimator? = null

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        scanAnimator?.cancel()
        scanAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 2400L
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = LinearInterpolator()
            addUpdateListener { anim ->
                scanProgress = anim.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    override fun onDetachedFromWindow() {
        scanAnimator?.cancel()
        scanAnimator = null
        focusAnimator?.cancel()
        focusAnimator = null
        super.onDetachedFromWindow()
    }

    fun showFocusRing(x: Float, y: Float) {
        focusX = x
        focusY = y
        focusAnimator?.cancel()
        focusAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 650L
            interpolator = DecelerateInterpolator()
            addUpdateListener { anim ->
                val t = anim.animatedValue as Float
                focusRadius = (42f - 14f * minOf(t * 2f, 1f)) * density
                focusAlpha = if (t < 0.7f) 220 else ((1f - (t - 0.7f) / 0.3f) * 220).toInt().coerceIn(0, 220)
                invalidate()
            }
            start()
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()
        if (w == 0f || h == 0f) return

        val boxSize = minOf(w, h) * 0.80f
        val left = (w - boxSize) / 2f
        val top = (h - boxSize) / 2f
        val right = left + boxSize
        val bottom = top + boxSize

        canvas.drawRect(0f, 0f, w, top, dimPaint)
        canvas.drawRect(0f, bottom, w, h, dimPaint)
        canvas.drawRect(0f, top, left, bottom, dimPaint)
        canvas.drawRect(right, top, w, bottom, dimPaint)

        val bl = bracketLength
        val cr = cornerRadius
        val d = cr * 2f

        tlArc.set(left, top, left + d, top + d)
        canvas.drawArc(tlArc, 180f, 90f, false, bracketPaint)
        canvas.drawLine(left, top + cr, left, top + bl, bracketPaint)
        canvas.drawLine(left + cr, top, left + bl, top, bracketPaint)

        trArc.set(right - d, top, right, top + d)
        canvas.drawArc(trArc, 270f, 90f, false, bracketPaint)
        canvas.drawLine(right, top + cr, right, top + bl, bracketPaint)
        canvas.drawLine(right - cr, top, right - bl, top, bracketPaint)

        blArc.set(left, bottom - d, left + d, bottom)
        canvas.drawArc(blArc, 90f, 90f, false, bracketPaint)
        canvas.drawLine(left, bottom - cr, left, bottom - bl, bracketPaint)
        canvas.drawLine(left + cr, bottom, left + bl, bottom, bracketPaint)

        brArc.set(right - d, bottom - d, right, bottom)
        canvas.drawArc(brArc, 0f, 90f, false, bracketPaint)
        canvas.drawLine(right, bottom - cr, right, bottom - bl, bracketPaint)
        canvas.drawLine(right - cr, bottom, right - bl, bottom, bracketPaint)

        // VSync-driven glowing horizontal scan line (zero per-frame allocations)
        val lineY = top + lineInset + scanProgress * (boxSize - lineInset * 2f)
        canvas.drawLine(left + lineInset, lineY, right - lineInset, lineY, linePaint)

        if (focusAlpha > 0 && focusX >= 0f && focusY >= 0f) {
            focusPaint.alpha = focusAlpha
            canvas.drawCircle(focusX, focusY, focusRadius, focusPaint)
        }
    }
}

/**
 * Decodes a CameraX JPEG ImageProxy into an upright Bitmap respecting sensor rotation degrees.
 */
fun ImageProxy.toBitmap(rotationDegrees: Int = 0): Bitmap? {
    val buffer = planes[0].buffer
    buffer.rewind()
    val bytes = ByteArray(buffer.remaining())
    buffer.get(bytes)
    val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    if (rotationDegrees == 0) return decoded
    val matrix = Matrix().apply { postRotate(rotationDegrees.toFloat()) }
    val rotated = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    if (rotated !== decoded) decoded.recycle()
    return rotated
}
