import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, SwitchCamera, Zap, Upload, Pill, FileText, ScanBarcode } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export type ScanMode = "pill" | "text" | "barcode";

export default function ScanPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [capturing, setCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [scanMode, setScanMode] = useState<ScanMode>("pill");
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

  const startCamera = useCallback(async () => {
    if (scanMode === "barcode") return; 
    
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (scanner && scanner.isScanning) {
        await scanner.stop();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch {
      // camera unavailable
    }
  }, [facingMode, scanMode, scanner]);

  const startBarcodeScanner = useCallback(async () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((tk) => tk.stop());
    setStreaming(true);
    
    const html5Qrcode = new Html5Qrcode("barcode-reader");
    setScanner(html5Qrcode);
    
    try {
      await html5Qrcode.start(
        { facingMode },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (decodedText) => {
          html5Qrcode.stop();
          navigate("/results", { state: { barcode: decodedText, mode: "barcode" } });
        },
        (errorMessage) => {
          // ignore scan errors
        }
      );
    } catch (err) {
      console.error(err);
    }
  }, [facingMode, navigate]);

  useEffect(() => {
    if (scanMode === "barcode") {
      startBarcodeScanner();
    } else {
      startCamera();
    }
    
    return () => {
      streamRef.current?.getTracks().forEach((tk) => tk.stop());
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(()=>console.log("stop error"));
      }
    };
  }, [startCamera, startBarcodeScanner, scanMode]);

  const capture = () => {
    if (scanMode === "barcode") return;
    if (!videoRef.current || !canvasRef.current) return;
    
    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    
    setTimeout(() => {
      navigate("/results", { state: { imageUrl: dataUrl, mode: scanMode } });
    }, 400);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      navigate("/results", { state: { imageUrl: reader.result as string, mode: scanMode } });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative min-h-screen bg-foreground flex flex-col">
      {/* Top Mode Segmented Control */}
      <div className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 bg-gradient-to-b from-foreground/90 to-transparent">
        <div className="flex mx-auto w-max bg-card/10 backdrop-blur-md p-1 rounded-full border border-card/20 text-card-foreground shadow-xl">
          <button
            onClick={() => setScanMode("pill")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all text-xs font-semibold ${scanMode === "pill" ? "bg-primary text-primary-foreground shadow-sm" : "text-card-foreground/70 hover:text-card-foreground"}`}
          >
            <Pill size={14} /> {t("scan.pill")}
          </button>
          <button
            onClick={() => setScanMode("text")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all text-xs font-semibold ${scanMode === "text" ? "bg-primary text-primary-foreground shadow-sm" : "text-card-foreground/70 hover:text-card-foreground"}`}
          >
            <FileText size={14} /> {t("scan.label")}
          </button>
          <button
            onClick={() => setScanMode("barcode")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all text-xs font-semibold ${scanMode === "barcode" ? "bg-primary text-primary-foreground shadow-sm" : "text-card-foreground/70 hover:text-card-foreground"}`}
          >
            <ScanBarcode size={14} /> {t("scan.barcode")}
          </button>
        </div>
      </div>

      {/* Camera view */}
      <div className="flex-1 w-full bg-black relative">
        <div className={`absolute inset-0 ${scanMode === "barcode" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          <div id="barcode-reader" style={{ width: "100%", height: "100%" }}></div>
        </div>

        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${scanMode === "barcode" ? "hidden" : "block"}`}
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlays */}
        {streaming && scanMode === "pill" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-56 h-56 rounded-full border-2 border-primary/70"
            />
          </div>
        )}

        {streaming && scanMode === "text" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-72 h-40 rounded-xl border-dashed border-2 border-primary/70"
            />
          </div>
        )}

        {!streaming && scanMode !== "barcode" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card">
            <Camera size={48} className="text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{t("scan.camera_loading")}</p>
          </div>
        )}

        {capturing && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-primary-foreground z-50"
          />
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/95 to-transparent pt-16 pb-8 px-6 safe-bottom z-30">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-foreground/10"
          >
            <X size={22} className="text-primary-foreground" />
          </button>

          {scanMode !== "barcode" ? (
             <button
               onClick={capture}
               disabled={!streaming}
               className="flex items-center justify-center w-18 h-18 rounded-full border-4 border-primary-foreground/60 bg-primary transition-transform active:scale-90 disabled:opacity-40"
               style={{ width: 72, height: 72 }}
             >
               <Zap size={28} className="text-primary-foreground" />
             </button>
          ) : (
            <div className="text-primary-foreground/60 text-xs text-center font-semibold">{t("scan.point_barcode")}</div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-foreground/10"
            >
              <SwitchCamera size={20} className="text-primary-foreground" />
            </button>
            <label className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-foreground/10 cursor-pointer">
              <Upload size={18} className="text-primary-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
        
        {scanMode !== "barcode" && (
           <p className="text-center text-xs font-semibold text-primary-foreground/70 mt-6">
             {t("scan.capture_hint")}
           </p>
        )}
      </div>
    </div>
  );
}
