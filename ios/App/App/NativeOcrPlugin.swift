import Foundation
import Capacitor
import Vision
import UIKit

@objc(NativeOcrPlugin)
public class NativeOcrPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeOcrPlugin"
    public let jsName = "NativeOcr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise)
    ]

    @objc func recognizeText(_ call: CAPPluginCall) {
        guard let imageData = call.getString("imageData") else {
            call.reject("Missing imageData")
            return
        }

        // Strip data:image/...;base64, prefix if present
        let base64String: String
        if imageData.contains(",") {
            base64String = String(imageData.split(separator: ",", maxSplits: 1).last ?? Substring(imageData))
        } else {
            base64String = imageData
        }

        guard let data = Data(base64Encoded: base64String),
              let uiImage = UIImage(data: data),
              let cgImage = uiImage.cgImage else {
            call.reject("Failed to decode image data")
            return
        }

        let request = VNRecognizeTextRequest { request, error in
            if let error = error {
                call.reject("OCR failed: \(error.localizedDescription)")
                return
            }
            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                call.resolve(["text": ""])
                return
            }
            let text = observations
                .compactMap { $0.topCandidates(1).first?.string }
                .joined(separator: "\n")
            call.resolve(["text": text])
        }

        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                call.reject("Failed to perform Vision request: \(error.localizedDescription)")
            }
        }
    }
}
