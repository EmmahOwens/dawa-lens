import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, SwitchCamera, Zap, Upload, Pill, FileText, ScanBarcode, Shield } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { ARInstructionOverlay, ARInstructionType } from "@/components/ui/ARInstruction";

export type ScanMode = "pill" | "text" | "barcode" | "verify";

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
  
  const [showAR, setShowAR] = useState(false);
  const [detectedInstructions, setDetectedInstructions] = useState<ARInstructionType[]>([]);

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

    // Simulate AR detection for the 'mega project' showcase
    if (scanMode === "pill" || scanMode === "text") {
      setDetectedInstructions(["water", "timed", "food"]);
      setShowAR(true);
      
      setTimeout(() => {
        navigate("/results", { state: { imageUrl: dataUrl, mode: scanMode } });
      }, 3500); // Wait for AR display
    } else {
      setTimeout(() => {
        navigate("/results", { state: { imageUrl: dataUrl, mode: scanMode } });
      }, 400);
    }
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
        <div className="flex mx-auto w-max bg-muted/20 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-2xl">
          <button
            onClick={() => setScanMode("pill")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all text-[11px] font-black uppercase tracking-widest ${scanMode === "pill" ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg scale-105" : "text-white/60 hover:text-white"}`}
          >
            <Pill size={16} /> {t("scan.pill")}
          </button>
          <button
            onClick={() => setScanMode("text")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all text-[11px] font-black uppercase tracking-widest ${scanMode === "text" ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg scale-105" : "text-white/60 hover:text-white"}`}
          >
            <FileText size={16} /> {t("scan.label")}
          </button>
          <button
            onClick={() => setScanMode("barcode")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all text-[11px] font-black uppercase tracking-widest ${scanMode === "barcode" ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg scale-105" : "text-white/60 hover:text-white"}`}
          >
            <ScanBarcode size={16} /> {t("scan.barcode")}
          </button>
          <button
            onClick={() => setScanMode("verify")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all text-[11px] font-black uppercase tracking-widest ${scanMode === "verify" ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg scale-105" : "text-white/60 hover:text-white"}`}
          >
            <Shield size={16} /> {t("scan.verify")}
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

        {streaming && scanMode === "verify" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-80 h-24 rounded-lg border-2 border-primary/70 bg-primary/5 backdrop-blur-sm"
            >
               <div className="absolute top-[-24px] left-0 right-0 text-center text-[10px] font-bold text-primary uppercase tracking-widest">{t("scan.align_scratch_code")}</div>
            </motion.div>
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
            animate={{ opacity: showAR ? 0.8 : 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-primary-foreground/20 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
          >
            {showAR && (
              <>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-8 text-center"
                >
                  <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Dawa-AR Detected</p>
                  <h2 className="text-xl font-bold text-white tracking-tight">Usage Instructions</h2>
                </motion.div>
                <ARInstructionOverlay instructions={detectedInstructions} />
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent pt-32 pb-12 px-8 safe-bottom z-30">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-14 h-14 rounded-full bg-white/10 backdrop-blur-2xl border border-white/10 text-white hover:bg-white/20 transition-all active:scale-90"
          >
            <X size={24} />
          </button>

          {scanMode !== "barcode" ? (
             <button
               onClick={capture}
               disabled={!streaming}
               className="flex items-center justify-center w-24 h-24 rounded-full border-[6px] border-white/20 bg-primary/10 backdrop-blur-md transition-all active:scale-90 disabled:opacity-40 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
             >
               <div className="w-18 h-18 rounded-full bg-white shadow-inner flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full border-2 border-primary animate-pulse" />
               </div>
             </button>
          ) : (
            <div className="text-white/60 text-[10px] text-center font-black uppercase tracking-widest leading-tight w-24 h-24 flex items-center justify-center">{t("scan.point_barcode")}</div>
          )}

          <div className="flex items-center gap-3">
            <button
               onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
               className="flex items-center justify-center w-14 h-14 rounded-full bg-white/10 backdrop-blur-2xl border border-white/10 text-white hover:bg-white/20 transition-all active:scale-90"
            >
               <SwitchCamera size={22} />
            </button>
            <label className="flex items-center justify-center w-14 h-14 rounded-full bg-white/10 backdrop-blur-2xl border border-white/10 text-white hover:bg-white/20 transition-all active:scale-90 cursor-pointer">
               <Upload size={22} />
               <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
        
        {scanMode !== "barcode" && (
           <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mt-10">
             {t("scan.capture_hint")}
           </p>
        )}
      </div>
    </div>
  );
}
