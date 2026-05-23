import Foundation
import Capacitor
import UIKit

@objc(NativePdfPlugin)
public class NativePdfPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativePdfPlugin"
    public let jsName = "NativePdf"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "generateReport", returnType: CAPPluginReturnPromise),
    ]

    @objc func generateReport(_ call: CAPPluginCall) {
        // Parse inputs
        let patientName   = call.getString("patientName")   ?? "Unknown Patient"
        let patientAge    = call.getString("patientAge")    ?? ""
        let dateRange     = call.getString("dateRange")     ?? ""
        let adherenceScore = call.getInt("adherenceScore")  ?? 0
        let generatedAt   = call.getString("generatedAt")   ?? ""
        let averageMood   = call.getDouble("averageMood")   ?? 0.0
        let averageEnergy = call.getDouble("averageEnergy") ?? 0.0

        let chartData    = (call.getArray("chartData")    ?? []).compactMap { $0 as? [String: Any] }
        let medicines    = (call.getArray("medicines")    ?? []).compactMap { $0 as? [String: Any] }
        let topSymptoms  = (call.getArray("topSymptoms")  ?? []).compactMap { $0 as? [String: Any] }

        DispatchQueue.global(qos: .userInitiated).async {
            let timestamp = Int(Date().timeIntervalSince1970)
            let tempFile  = FileManager.default.temporaryDirectory
                .appendingPathComponent("DawaLens-Report-\(timestamp).pdf")

            // A4 at 72 dpi: 595 × 842 pt
            let pageRect = CGRect(x: 0, y: 0, width: 595, height: 842)
            let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

            let pdfData = renderer.pdfData { ctx in
                ctx.beginPage()
                guard let context = UIGraphicsGetCurrentContext() else { return }

                // ── Shared palette ────────────────────────────────────────────
                let brandBlue  = UIColor(red: 0.10, green: 0.34, blue: 0.86, alpha: 1)
                let darkColor  = UIColor(red: 0.08, green: 0.08, blue: 0.08, alpha: 1)
                let grayColor  = UIColor(red: 0.50, green: 0.50, blue: 0.50, alpha: 1)
                let greenColor = UIColor(red: 0.133, green: 0.773, blue: 0.369, alpha: 1) // #22c55e
                let amberColor = UIColor(red: 0.961, green: 0.620, blue: 0.043, alpha: 1) // #f59e0b
                let redColor   = UIColor(red: 0.937, green: 0.267, blue: 0.267, alpha: 1) // #ef4444

                func scoreColor(_ s: Int) -> UIColor {
                    s >= 80 ? greenColor : s >= 60 ? amberColor : redColor
                }

                // ── Inline drawing helpers ────────────────────────────────────
                func attrs(_ font: UIFont, _ color: UIColor) -> [NSAttributedString.Key: Any] {
                    [.font: font, .foregroundColor: color]
                }

                func drawText(_ text: String, at pt: CGPoint, font: UIFont, color: UIColor) {
                    NSAttributedString(string: text, attributes: attrs(font, color)).draw(at: pt)
                }

                func measure(_ text: String, font: UIFont) -> CGSize {
                    NSAttributedString(string: text, attributes: attrs(font, .black)).size()
                }

                // ── 1. Header bar ─────────────────────────────────────────────
                brandBlue.setFill()
                context.fill(CGRect(x: 0, y: 0, width: 595, height: 70))

                drawText("DAWA LENS",
                         at: CGPoint(x: 20, y: 20),
                         font: .boldSystemFont(ofSize: 22),
                         color: .white)

                let subText = "Health Report"
                let subFont = UIFont.systemFont(ofSize: 13)
                let subW    = measure(subText, font: subFont).width
                drawText(subText,
                         at: CGPoint(x: 595 - subW - 20, y: 28),
                         font: subFont,
                         color: .white)

                // ── 2. Patient block ──────────────────────────────────────────
                var y: CGFloat = 90

                drawText(patientName,
                         at: CGPoint(x: 20, y: y),
                         font: .boldSystemFont(ofSize: 20),
                         color: darkColor)
                y += 26

                let meta = patientAge.isEmpty ? dateRange : "\(patientAge)  •  \(dateRange)"
                drawText(meta,
                         at: CGPoint(x: 20, y: y),
                         font: .systemFont(ofSize: 12),
                         color: grayColor)
                y += 30

                // ── 3. Adherence circle (right side, radius 40 pt) ────────────
                let circleColor  = scoreColor(adherenceScore)
                let circleRadius: CGFloat = 40
                let circleCX: CGFloat     = 550   // right margin keeps circle on-page
                let circleCY: CGFloat     = y + circleRadius

                let circleRect = CGRect(x: circleCX - circleRadius,
                                        y: circleCY - circleRadius,
                                        width:  circleRadius * 2,
                                        height: circleRadius * 2)
                circleColor.setStroke()
                context.setLineWidth(3.0)
                context.strokeEllipse(in: circleRect)

                let scoreFont = UIFont.boldSystemFont(ofSize: 36)
                let scoreText = "\(adherenceScore)%"
                let scoreSize = measure(scoreText, font: scoreFont)
                drawText(scoreText,
                         at: CGPoint(x: circleCX - scoreSize.width  / 2,
                                     y: circleCY - scoreSize.height / 2),
                         font: scoreFont,
                         color: circleColor)

                let lblFont = UIFont.systemFont(ofSize: 9)
                let lblText = "WEEKLY ADHERENCE"
                let lblW    = measure(lblText, font: lblFont).width
                drawText(lblText,
                         at: CGPoint(x: circleCX - lblW / 2,
                                     y: circleCY + circleRadius + 4),
                         font: lblFont,
                         color: grayColor)

                // ── 4. 7-day bar chart (left of circle) ───────────────────────
                let sectionFont = UIFont.boldSystemFont(ofSize: 11)
                drawText("7-DAY ADHERENCE",
                         at: CGPoint(x: 20, y: y),
                         font: sectionFont,
                         color: darkColor)
                y += 16

                let barMaxW: CGFloat = 280   // max bar width, fits left of circle
                let barH:    CGFloat = 10

                for item in chartData {
                    let dayName = item["name"] as? String ?? ""
                    // adherence may arrive as Int or Double from JS
                    let adh: Int
                    if let i = item["adherence"] as? Int         { adh = i }
                    else if let d = item["adherence"] as? Double { adh = Int(d) }
                    else                                          { adh = 0 }

                    let barColor = scoreColor(adh)
                    let dayFont  = UIFont.systemFont(ofSize: 8)

                    drawText(dayName,
                             at: CGPoint(x: 20, y: y + 1),
                             font: dayFont,
                             color: grayColor)

                    let barW = barMaxW * max(CGFloat(adh) / 100.0, 0.02)
                    barColor.setFill()
                    context.fill(CGRect(x: 60, y: y + 1, width: barW, height: barH))

                    drawText("\(adh)%",
                             at: CGPoint(x: 345, y: y + 1),
                             font: dayFont,
                             color: grayColor)

                    y += barH + 8
                }

                // Ensure y is below the circle before proceeding
                let circleBottom = circleCY + circleRadius + 20
                if y < circleBottom { y = circleBottom }

                y += 10

                // ── 5. Medicines section ──────────────────────────────────────
                drawText("YOUR MEDICINES",
                         at: CGPoint(x: 20, y: y),
                         font: sectionFont,
                         color: darkColor)
                y += 16

                for med in medicines {
                    let name   = med["name"]   as? String ?? ""
                    let dosage = med["dosage"] as? String ?? ""
                    var days: Int?
                    if let d = med["daysRemaining"] as? Int         { days = d }
                    else if let d = med["daysRemaining"] as? Double { days = Int(d) }

                    drawText(name,
                             at: CGPoint(x: 20, y: y),
                             font: .boldSystemFont(ofSize: 12),
                             color: darkColor)
                    y += 15

                    var detail = dosage
                    if let d = days {
                        detail += detail.isEmpty ? "\(d) days left" : "  •  \(d) days left"
                    }
                    if !detail.isEmpty {
                        drawText(detail,
                                 at: CGPoint(x: 20, y: y),
                                 font: .systemFont(ofSize: 11),
                                 color: grayColor)
                        y += 15
                    }
                }

                y += 14

                // ── 6. Wellness snapshot ──────────────────────────────────────
                drawText("WELLNESS SNAPSHOT",
                         at: CGPoint(x: 20, y: y),
                         font: sectionFont,
                         color: darkColor)
                y += 16

                let dotR:    CGFloat = 5
                let dotStep: CGFloat = 14

                // Mood row
                drawText("Mood",
                         at: CGPoint(x: 20, y: y),
                         font: .systemFont(ofSize: 11),
                         color: grayColor)
                let moodFilled = min(5, max(0, Int(averageMood.rounded())))
                for i in 0..<5 {
                    let cx  = 80 + CGFloat(i) * dotStep
                    let rct = CGRect(x: cx - dotR, y: y, width: dotR * 2, height: dotR * 2)
                    (i < moodFilled ? amberColor : UIColor.lightGray).setFill()
                    context.fillEllipse(in: rct)
                }
                y += dotR * 2 + 8

                // Energy row
                drawText("Energy",
                         at: CGPoint(x: 20, y: y),
                         font: .systemFont(ofSize: 11),
                         color: grayColor)
                let energyFilled = min(5, max(0, Int(averageEnergy.rounded())))
                let blueColor = UIColor(red: 0.20, green: 0.60, blue: 1.00, alpha: 1)
                for i in 0..<5 {
                    let cx  = 80 + CGFloat(i) * dotStep
                    let rct = CGRect(x: cx - dotR, y: y, width: dotR * 2, height: dotR * 2)
                    (i < energyFilled ? blueColor : UIColor.lightGray).setFill()
                    context.fillEllipse(in: rct)
                }
                y += dotR * 2 + 12

                // Top symptoms badges
                if !topSymptoms.isEmpty {
                    drawText("Top Symptoms:",
                             at: CGPoint(x: 20, y: y),
                             font: .systemFont(ofSize: 10),
                             color: grayColor)
                    y += 14

                    var badgeX:    CGFloat = 20
                    let badgePad:  CGFloat = 6
                    let badgeFont  = UIFont.systemFont(ofSize: 9)
                    let borderClr  = UIColor(red: 0.1, green: 0.34, blue: 0.86, alpha: 0.4)

                    for symptom in topSymptoms {
                        let sName  = symptom["name"] as? String ?? ""
                        let sCount: Int
                        if let c = symptom["count"] as? Int         { sCount = c }
                        else if let c = symptom["count"] as? Double { sCount = Int(c) }
                        else                                         { sCount = 0 }

                        let badgeText = "\(sName) (\(sCount))"
                        let bSize     = measure(badgeText, font: badgeFont)
                        let bW        = bSize.width + badgePad * 2
                        let bH        = bSize.height + badgePad

                        // Wrap to next line when near the right margin
                        if badgeX + bW > 560 {
                            badgeX  = 20
                            y      += bH + 4
                        }

                        let bRect = CGRect(x: badgeX, y: y, width: bW, height: bH)
                        borderClr.setStroke()
                        context.setLineWidth(1.0)
                        UIBezierPath(roundedRect: bRect, cornerRadius: 4).stroke()

                        drawText(badgeText,
                                 at: CGPoint(x: badgeX + badgePad, y: y + badgePad / 2),
                                 font: badgeFont,
                                 color: brandBlue)

                        badgeX += bW + 6
                    }
                    y += 24
                }

                // ── 7. Footer ─────────────────────────────────────────────────
                let footerText = "Generated by Dawa Lens  •  \(generatedAt)"
                let footerFont = UIFont.systemFont(ofSize: 9)
                let footerW    = measure(footerText, font: footerFont).width
                drawText(footerText,
                         at: CGPoint(x: (595 - footerW) / 2, y: 820),
                         font: footerFont,
                         color: grayColor)
            }

            // Write PDF to temp file and resolve
            do {
                try pdfData.write(to: tempFile)
                var result = JSObject()
                result["filePath"] = tempFile.path
                result["fileUri"]  = tempFile.absoluteString
                call.resolve(result)
            } catch {
                call.reject("Failed to write PDF: \(error.localizedDescription)")
            }
        }
    }
}
