import UIKit
import AVFoundation
import CoreImage

public class NativeScanViewController: UIViewController {

    public var scanMode: String = "pill"
    public var onCapture: ((String) -> Void)?
    public var onCancel: (() -> Void)?

    private var captureSession: AVCaptureSession!
    private var videoPreviewLayer: AVCaptureVideoPreviewLayer!
    private var photoOutput: AVCapturePhotoOutput!
    private var currentDevice: AVCaptureDevice?
    private var flashEnabled = false
    private var scanLineLayer: CALayer!
    private var scanLineTimer: CADisplayLink?
    private var scanLineY: CGFloat = 0
    private var scanLineDirection: CGFloat = 1

    // Scan rect bounds used by the animated scan line
    private var _scanRectMinY: CGFloat = 0
    private var _scanRectMaxY: CGFloat = 0

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupCamera()
        setupOverlay()
        setupControls()
    }

    public override var prefersStatusBarHidden: Bool { true }

    private func setupCamera() {
        captureSession = AVCaptureSession()
        captureSession.sessionPreset = .photo

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: device) else { return }
        currentDevice = device

        photoOutput = AVCapturePhotoOutput()
        if captureSession.canAddInput(input) { captureSession.addInput(input) }
        if captureSession.canAddOutput(photoOutput) { captureSession.addOutput(photoOutput) }

        videoPreviewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        videoPreviewLayer.videoGravity = .resizeAspectFill
        videoPreviewLayer.frame = view.layer.bounds
        view.layer.addSublayer(videoPreviewLayer)

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.startRunning()
        }
    }

    private func setupOverlay() {
        let overlay = UIView(frame: view.bounds)
        overlay.backgroundColor = .clear
        overlay.isUserInteractionEnabled = false
        view.addSubview(overlay)

        // Square scan frame centred in the view
        let w = min(view.bounds.width, view.bounds.height) * 0.82
        let cx = view.bounds.midX
        let cy = view.bounds.midY
        let scanRect = CGRect(x: cx - w / 2, y: cy - w / 2, width: w, height: w)

        // Store bounds for the animated scan line
        _scanRectMinY = scanRect.minY
        _scanRectMaxY = scanRect.maxY

        // Dim the area outside the scan rect using an even-odd cutout
        let dimLayer = CAShapeLayer()
        let dimPath = UIBezierPath(rect: view.bounds)
        let holePath = UIBezierPath(roundedRect: scanRect, cornerRadius: 16)
        dimPath.append(holePath)
        dimPath.usesEvenOddFillRule = true
        dimLayer.path = dimPath.cgPath
        dimLayer.fillRule = .evenOdd
        dimLayer.fillColor = UIColor.black.withAlphaComponent(0.55).cgColor
        overlay.layer.addSublayer(dimLayer)

        // Corner brackets
        let cornerColor = UIColor(red: 0.2, green: 0.8, blue: 0.4, alpha: 1.0).cgColor
        let cornerLength: CGFloat = 28
        let corners: [(CGPoint, [(CGPoint, CGPoint)])] = [
            (CGPoint(x: scanRect.minX, y: scanRect.minY), [
                (CGPoint(x: scanRect.minX, y: scanRect.minY + cornerLength), CGPoint(x: scanRect.minX, y: scanRect.minY)),
                (CGPoint(x: scanRect.minX, y: scanRect.minY), CGPoint(x: scanRect.minX + cornerLength, y: scanRect.minY))
            ]),
            (CGPoint(x: scanRect.maxX, y: scanRect.minY), [
                (CGPoint(x: scanRect.maxX, y: scanRect.minY + cornerLength), CGPoint(x: scanRect.maxX, y: scanRect.minY)),
                (CGPoint(x: scanRect.maxX, y: scanRect.minY), CGPoint(x: scanRect.maxX - cornerLength, y: scanRect.minY))
            ]),
            (CGPoint(x: scanRect.minX, y: scanRect.maxY), [
                (CGPoint(x: scanRect.minX, y: scanRect.maxY - cornerLength), CGPoint(x: scanRect.minX, y: scanRect.maxY)),
                (CGPoint(x: scanRect.minX, y: scanRect.maxY), CGPoint(x: scanRect.minX + cornerLength, y: scanRect.maxY))
            ]),
            (CGPoint(x: scanRect.maxX, y: scanRect.maxY), [
                (CGPoint(x: scanRect.maxX, y: scanRect.maxY - cornerLength), CGPoint(x: scanRect.maxX, y: scanRect.maxY)),
                (CGPoint(x: scanRect.maxX, y: scanRect.maxY), CGPoint(x: scanRect.maxX - cornerLength, y: scanRect.maxY))
            ])
        ]

        for (_, lines) in corners {
            for (from, to) in lines {
                let line = CAShapeLayer()
                let path = UIBezierPath()
                path.move(to: from)
                path.addLine(to: to)
                line.path = path.cgPath
                line.strokeColor = cornerColor
                line.lineWidth = 3
                line.fillColor = UIColor.clear.cgColor
                overlay.layer.addSublayer(line)
            }
        }

        // Animated scan line
        scanLineLayer = CALayer()
        scanLineLayer.backgroundColor = UIColor(red: 0.2, green: 0.8, blue: 0.4, alpha: 0.8).cgColor
        scanLineLayer.frame = CGRect(x: scanRect.minX + 2, y: scanRect.minY, width: w - 4, height: 2)
        overlay.layer.addSublayer(scanLineLayer)

        scanLineY = _scanRectMinY
        scanLineTimer = CADisplayLink(target: self, selector: #selector(animateScanLine))
        scanLineTimer?.add(to: .main, forMode: .common)
    }

    @objc private func animateScanLine() {
        scanLineY += scanLineDirection * 2.0
        if scanLineY >= _scanRectMaxY { scanLineDirection = -1 }
        if scanLineY <= _scanRectMinY { scanLineDirection = 1 }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        scanLineLayer.frame.origin.y = scanLineY
        CATransaction.commit()
    }

    private func setupControls() {
        // Close button (top-left)
        let closeBtn = UIButton(type: .system)
        closeBtn.setTitle("✕", for: .normal)
        closeBtn.titleLabel?.font = UIFont.systemFont(ofSize: 22, weight: .bold)
        closeBtn.tintColor = .white
        closeBtn.frame = CGRect(x: 20, y: 60, width: 44, height: 44)
        closeBtn.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        view.addSubview(closeBtn)

        // Flash toggle (top-right)
        let flashBtn = UIButton(type: .system)
        flashBtn.setTitle("⚡", for: .normal)
        flashBtn.titleLabel?.font = UIFont.systemFont(ofSize: 22)
        flashBtn.frame = CGRect(x: view.bounds.width - 64, y: 60, width: 44, height: 44)
        flashBtn.addTarget(self, action: #selector(flashTapped), for: .touchUpInside)
        view.addSubview(flashBtn)

        // Shutter button (bottom-centre)
        let captureBtn = UIButton(type: .custom)
        captureBtn.backgroundColor = .white
        captureBtn.layer.cornerRadius = 40
        captureBtn.layer.borderWidth = 4
        captureBtn.layer.borderColor = UIColor.white.withAlphaComponent(0.4).cgColor
        let btnSize: CGFloat = 80
        captureBtn.frame = CGRect(x: view.bounds.midX - btnSize / 2, y: view.bounds.height - btnSize - 60, width: btnSize, height: btnSize)
        captureBtn.addTarget(self, action: #selector(captureTapped), for: .touchUpInside)
        view.addSubview(captureBtn)
    }

    @objc private func cancelTapped() {
        scanLineTimer?.invalidate()
        captureSession?.stopRunning()
        dismiss(animated: true) { [weak self] in self?.onCancel?() }
    }

    @objc private func flashTapped() {
        guard let device = currentDevice, device.hasTorch else { return }
        flashEnabled = !flashEnabled
        try? device.lockForConfiguration()
        device.torchMode = flashEnabled ? .on : .off
        device.unlockForConfiguration()
    }

    @objc private func captureTapped() {
        let settings = AVCapturePhotoSettings()
        settings.flashMode = flashEnabled ? .on : .off
        photoOutput.capturePhoto(with: settings, delegate: self)
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        videoPreviewLayer?.frame = view.layer.bounds
    }

    deinit {
        scanLineTimer?.invalidate()
    }

    // Pre-process the image with Core Image for better OCR/pill-ID accuracy
    private func preprocessImageData(_ data: Data) -> Data {
        guard let source = CIImage(data: data) else { return data }

        let sharpen = CIFilter(name: "CISharpenLuminance")!
        sharpen.setValue(source, forKey: kCIInputImageKey)
        sharpen.setValue(0.7, forKey: kCIInputSharpnessKey)

        guard let sharpened = sharpen.outputImage else { return data }

        let colorControls = CIFilter(name: "CIColorControls")!
        colorControls.setValue(sharpened, forKey: kCIInputImageKey)
        colorControls.setValue(1.2, forKey: kCIInputContrastKey)
        colorControls.setValue(0.04, forKey: kCIInputBrightnessKey)

        guard let enhanced = colorControls.outputImage else { return data }

        let ctx = CIContext(options: [.useSoftwareRenderer: false])
        guard let cgImage = ctx.createCGImage(enhanced, from: enhanced.extent),
              let jpegData = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.88)
        else { return data }

        return jpegData
    }
}

extension NativeScanViewController: AVCapturePhotoCaptureDelegate {
    public func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        scanLineTimer?.invalidate()
        captureSession?.stopRunning()

        guard error == nil,
              let data = photo.fileDataRepresentation() else {
            DispatchQueue.main.async { [weak self] in
                self?.dismiss(animated: true) { self?.onCancel?() }
            }
            return
        }

        let processedData = preprocessImageData(data)
        let base64 = processedData.base64EncodedString()
        let dataUrl = "data:image/jpeg;base64,\(base64)"

        DispatchQueue.main.async { [weak self] in
            self?.dismiss(animated: true) { self?.onCapture?(dataUrl) }
        }
    }
}
