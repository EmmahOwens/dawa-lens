package com.dawainnovation.lens

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream

@CapacitorPlugin(name = "NativePdf")
class NativePdfPlugin : Plugin() {

    @PluginMethod
    fun generateReport(call: PluginCall) {
        // Run PDF generation on a background thread — Canvas/PdfDocument can be slow
        Thread {
            try {
                // ── Extract fields from the plugin call ─────────────────────────────
                val data         = call.data
                val patientName  = data.optString("patientName", "Unknown Patient")
                val patientAge   = data.optString("patientAge", "")
                val dateRange    = data.optString("dateRange", "")
                val adherenceScore = data.optInt("adherenceScore", 0)
                val chartData    = call.getArray("chartData")   ?: JSArray()
                val medicines    = call.getArray("medicines")   ?: JSArray()
                val topSymptoms  = call.getArray("topSymptoms") ?: JSArray()
                val averageMood  = data.optDouble("averageMood", 0.0)
                val averageEnergy = data.optDouble("averageEnergy", 0.0)
                val generatedAt  = data.optString("generatedAt", "")

                // ── Create A4 page: 595 × 842 points at 72 dpi ──────────────────────
                val document = PdfDocument()
                val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
                val page = document.startPage(pageInfo)
                val canvas = page.canvas

                val W  = 595f
                val H  = 842f
                val ml = 36f          // left margin
                val mr = W - 36f      // right edge

                val bold   = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
                val normal = Typeface.SANS_SERIF

                // Single reusable Paint — mutated in place throughout
                val p = Paint(Paint.ANTI_ALIAS_FLAG)

                // ── HEADER BAR ───────────────────────────────────────────────────────
                p.set(p); p.style = Paint.Style.FILL
                p.color = Color.parseColor("#1a56db")
                canvas.drawRect(0f, 0f, W, 80f, p)

                // "DAWA LENS" — left
                p.color = Color.WHITE; p.textSize = 20f; p.typeface = bold
                canvas.drawText("DAWA LENS", ml, 52f, p)

                // "Health Report" — right
                p.textSize = 13f; p.typeface = normal; p.textAlign = Paint.Align.RIGHT
                canvas.drawText("Health Report", mr, 52f, p)
                p.textAlign = Paint.Align.LEFT

                // ── PATIENT INFO BLOCK ───────────────────────────────────────────────
                var y = 108f

                p.color = Color.parseColor("#111827"); p.textSize = 22f; p.typeface = bold
                canvas.drawText(patientName, ml, y, p)
                y += 6f

                p.color = Color.parseColor("#6b7280"); p.textSize = 11f; p.typeface = normal
                if (patientAge.isNotEmpty()) { y += 16f; canvas.drawText("Age: $patientAge", ml, y, p) }
                if (dateRange.isNotEmpty())  { y += 16f; canvas.drawText(dateRange, ml, y, p) }

                // Adherence score — large, right-aligned, colored by level
                val scoreColor = when {
                    adherenceScore >= 80 -> Color.parseColor("#16a34a") // green
                    adherenceScore >= 60 -> Color.parseColor("#d97706") // amber
                    else                 -> Color.parseColor("#dc2626") // red
                }
                p.color = scoreColor; p.textSize = 44f; p.typeface = bold
                p.textAlign = Paint.Align.RIGHT
                canvas.drawText("$adherenceScore%", mr, 128f, p)

                p.color = Color.parseColor("#6b7280"); p.textSize = 9f; p.typeface = normal
                canvas.drawText("Weekly Adherence", mr, 142f, p)
                p.textAlign = Paint.Align.LEFT

                y = maxOf(y + 20f, 158f)

                // ── SECTION: WEEKLY ADHERENCE CHART ─────────────────────────────────
                y = drawDivider(canvas, p, ml, mr, y)

                p.color = Color.parseColor("#374151"); p.textSize = 10f; p.typeface = bold
                canvas.drawText("WEEKLY ADHERENCE", ml, y, p)
                y += 13f

                val labelCol = 48f          // width reserved for day label
                val barAreaW = mr - ml - labelCol - 38f   // remaining width for bar + % text
                val barH     = 11f
                val rowGap   = 19f

                for (i in 0 until minOf(chartData.length(), 7)) {
                    if (y > H - 60f) break
                    val item      = chartData.getJSONObject(i)
                    val dayLabel  = item.optString("name", "Day ${i + 1}").take(9)
                    val adherence = item.optDouble("adherence", 0.0).coerceIn(0.0, 100.0)
                    val bx        = ml + labelCol

                    // Day label
                    p.color = Color.parseColor("#6b7280"); p.textSize = 8f; p.typeface = normal
                    canvas.drawText(dayLabel, ml, y + barH, p)

                    // Background track
                    p.color = Color.parseColor("#f3f4f6"); p.style = Paint.Style.FILL
                    canvas.drawRoundRect(bx, y, bx + barAreaW, y + barH, 3f, 3f, p)

                    // Filled portion
                    val fillW = (adherence / 100.0 * barAreaW).toFloat()
                    if (fillW > 2f) {
                        p.color = when {
                            adherence >= 80 -> Color.parseColor("#16a34a")
                            adherence >= 60 -> Color.parseColor("#d97706")
                            else            -> Color.parseColor("#ef4444")
                        }
                        canvas.drawRoundRect(bx, y, bx + fillW, y + barH, 3f, 3f, p)
                    }

                    // Percentage text right of bar
                    p.color = Color.parseColor("#374151"); p.textSize = 8f; p.typeface = normal
                    p.textAlign = Paint.Align.RIGHT
                    canvas.drawText("${adherence.toInt()}%", mr, y + barH, p)
                    p.textAlign = Paint.Align.LEFT

                    y += rowGap
                }

                // ── SECTION: MEDICINES ───────────────────────────────────────────────
                y = drawDivider(canvas, p, ml, mr, y + 6f)

                p.color = Color.parseColor("#374151"); p.textSize = 10f; p.typeface = bold
                canvas.drawText("YOUR MEDICINES", ml, y, p)
                y += 14f

                for (i in 0 until minOf(medicines.length(), 6)) {
                    if (y > H - 80f) break
                    val med      = medicines.getJSONObject(i)
                    val medName  = med.optString("name", "Unknown")
                    val dosage   = med.optString("dosage", "")
                    val daysRem  = if (!med.isNull("daysRemaining")) med.optInt("daysRemaining", -1) else -1

                    p.color = Color.parseColor("#111827"); p.textSize = 10f; p.typeface = bold
                    canvas.drawText("\u2022 $medName", ml, y, p)

                    val detail = buildString {
                        if (dosage.isNotEmpty()) append(dosage)
                        if (daysRem >= 0) {
                            if (dosage.isNotEmpty()) append("  \u00B7  ")
                            append("$daysRem days left")
                        }
                    }
                    if (detail.isNotEmpty()) {
                        p.color = Color.parseColor("#6b7280"); p.textSize = 10f; p.typeface = normal
                        p.textAlign = Paint.Align.RIGHT
                        canvas.drawText(detail, mr, y, p)
                        p.textAlign = Paint.Align.LEFT
                    }
                    y += 17f
                }

                // ── SECTION: WELLNESS SUMMARY ────────────────────────────────────────
                if (y < H - 90f) {
                    y = drawDivider(canvas, p, ml, mr, y + 6f)

                    p.color = Color.parseColor("#374151"); p.textSize = 10f; p.typeface = bold
                    canvas.drawText("WELLNESS SUMMARY", ml, y, p)
                    y += 14f

                    y = drawWellnessBar(canvas, p, ml, y, "Mood",   averageMood,   bold, normal)
                    y = drawWellnessBar(canvas, p, ml, y, "Energy", averageEnergy, bold, normal)
                    y += 4f

                    if (topSymptoms.length() > 0 && y < H - 50f) {
                        p.color = Color.parseColor("#374151"); p.textSize = 10f; p.typeface = bold
                        canvas.drawText("Top Symptoms:", ml, y, p)
                        y += 13f

                        for (i in 0 until minOf(topSymptoms.length(), 5)) {
                            if (y > H - 35f) break
                            val sym     = topSymptoms.getJSONObject(i)
                            val symName = sym.optString("name", "")
                            val count   = sym.optInt("count", 0)
                            p.color = Color.parseColor("#6b7280"); p.textSize = 10f; p.typeface = normal
                            canvas.drawText("  $symName  \u00D7$count", ml, y, p)
                            y += 13f
                        }
                    }
                }

                // ── FOOTER ───────────────────────────────────────────────────────────
                p.color = Color.parseColor("#9ca3af"); p.textSize = 8f; p.typeface = normal
                p.textAlign = Paint.Align.CENTER
                canvas.drawText(
                    "Generated by Dawa Lens  \u2022  $generatedAt",
                    W / 2f, H - 18f, p
                )
                p.textAlign = Paint.Align.LEFT

                document.finishPage(page)

                // ── SAVE TO CACHE ────────────────────────────────────────────────────
                val reportsDir = File(context.cacheDir, "reports")
                reportsDir.mkdirs()
                val outFile = File(reportsDir, "DawaLens-Report-${System.currentTimeMillis()}.pdf")
                FileOutputStream(outFile).use { document.writeTo(it) }
                document.close()

                // Content URI via the FileProvider already declared in AndroidManifest
                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    outFile
                )

                call.resolve(JSObject().apply {
                    put("filePath", outFile.absolutePath)
                    put("fileUri", uri.toString())
                })
            } catch (e: Exception) {
                call.reject("PDF generation failed: ${e.message}", e)
            }
        }.start()
    }

    // ── Private helpers ──────────────────────────────────────────────────────────

    /** Draws a horizontal divider line and returns updated y below it. */
    private fun drawDivider(canvas: Canvas, p: Paint, ml: Float, mr: Float, y: Float): Float {
        p.color = Color.parseColor("#e5e7eb")
        p.strokeWidth = 1f
        p.style = Paint.Style.STROKE
        canvas.drawLine(ml, y, mr, y, p)
        p.style = Paint.Style.FILL
        return y + 14f
    }

    /**
     * Draws a labeled mini progress bar for mood/energy (scale 0–5).
     * Returns the y position after the bar row.
     */
    private fun drawWellnessBar(
        canvas: Canvas, p: Paint,
        ml: Float, y: Float,
        label: String, value: Double,
        bold: Typeface, normal: Typeface
    ): Float {
        val labelW  = 44f
        val barW    = 130f
        val barH    = 10f
        val clamped = value.coerceIn(0.0, 5.0)
        val fill    = (clamped / 5.0).toFloat()

        // Label
        p.color = Color.parseColor("#374151"); p.textSize = 10f; p.typeface = normal
        canvas.drawText(label, ml, y + barH, p)

        // Background track
        val bx = ml + labelW
        p.color = Color.parseColor("#f3f4f6"); p.style = Paint.Style.FILL
        canvas.drawRoundRect(bx, y, bx + barW, y + barH, 4f, 4f, p)

        // Filled portion
        if (fill > 0.01f) {
            p.color = when {
                clamped >= 4.0 -> Color.parseColor("#16a34a")
                clamped >= 3.0 -> Color.parseColor("#d97706")
                else           -> Color.parseColor("#dc2626")
            }
            canvas.drawRoundRect(bx, y, bx + barW * fill, y + barH, 4f, 4f, p)
        }

        // Numeric value
        p.color = Color.parseColor("#374151"); p.textSize = 10f; p.typeface = bold
        canvas.drawText(String.format("%.1f / 5", clamped), bx + barW + 8f, y + barH, p)

        return y + 18f
    }
}
