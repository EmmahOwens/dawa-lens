import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, SwitchCamera, Zap, Upload, Pill, FileText, ScanBarcode, Shield } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { ARInstructionOverlay, ARInstructionType } from "@/components/ui/ARInstruction";
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

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
  const [flashlightOn, setFlashlightOn] = useState(false);

  const toggleFlashlight = useCallback(async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities() as any;
        if (capabilities.torch) {
          await track.applyConstraints({
            advanced: [{ torch: !flashlightOn }]
          } as any);
          setFlashlightOn(!flashlightOn);
        }
      }
    } catch (err) {
      console.error("Flashlight error:", err);
    }
  }, [flashlightOn]);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos
        });
        if (image.dataUrl) {
          navigate("/results", { state: { imageUrl: image.dataUrl, mode: scanMode } });
        }
      } catch (err) {
        console.warn("User cancelled photo picker:", err);
      }
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      navigate("/results", { state: { imageUrl: reader.result as string, mode: scanMode } });
    };
    reader.readAsDataURL(file);
  };

  const triggerNativeUpload = (e: React.MouseEvent) => {
    if (Capacitor.isNativePlatform()) {
      e.preventDefault(); // Stop the <input> from opening the Web file picker
      handleFileUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <div className="relative min-h-screen bg-foreground flex flex-col">
      {/* Top App Bar with X, Mode Selector, and Flashlight */}
      <div className="absolute top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top,2rem)] px-4 pb-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
          {/* Top Left: Exit Button */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white"
          >
            <X size={20} />
          </button>

          {/* Center: Mode Selector Pill */}
          <div className="flex-1 flex bg-white/5 backdrop-blur-xl p-1 rounded-full border border-white/5 shadow-2xl relative overflow-hidden h-11">
            <AnimatePresence mode="popLayout">
              {["pill", "text", "barcode", "verify"].map((mode) => {
                const active = scanMode === mode;
                const Icon = 
                  mode === "pill" ? Pill : 
                  mode === "text" ? FileText : 
                  mode === "barcode" ? ScanBarcode : 
                  Shield;
                
                return (
                  <button
                    key={mode}
                    onClick={() => setScanMode(mode as ScanMode)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 rounded-full transition-all duration-300 z-10 ${active ? "text-primary-foreground" : "text-white/40 hover:text-white"}`}
                  >
                    {active && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute inset-0 bg-primary rounded-full -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                    {active && (
                      <motion.span 
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline"
                      >
                        {t(`scan.${mode}`)}
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Top Right: Flashlight Toggle */}
          <button
            onClick={toggleFlashlight}
            className={`flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-md border transition-all ${flashlightOn ? "bg-primary border-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.5)]" : "bg-white/10 border-white/10 text-white"}`}
          >
            <Zap size={20} fill={flashlightOn ? "currentColor" : "none"} />
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
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: [1, 1.02, 1], opacity: 1 }}
              transition={{ scale: { repeat: Infinity, duration: 2, ease: "easeInOut" }, opacity: { duration: 0.5 } }}
              className="relative w-64 h-64"
            >
               <div className="absolute inset-0 border-[0.5px] border-white/20" />
               <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary" />
               <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary" />
               <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary" />
               <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary" />
            </motion.div>
          </div>
        )}

        {streaming && scanMode === "text" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <motion.div
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: [1, 1.02, 1], opacity: 1 }}
              transition={{ scale: { repeat: Infinity, duration: 2.5, ease: "easeInOut" }, opacity: { duration: 0.5 } }}
              className="relative w-80 h-40"
            >
               <div className="absolute inset-0 border-[0.5px] border-white/20" />
               <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary" />
               <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary" />
               <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary" />
               <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary" />
            </motion.div>
          </div>
        )}

        {streaming && scanMode === "verify" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-80 h-24 rounded-xl border border-primary bg-primary/10 backdrop-blur-md"
            >
               <div className="absolute top-[-28px] left-0 right-0 text-center text-[10px] font-bold text-primary uppercase tracking-wider">{t("scan.align_scratch_code")}</div>
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
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                  className="mb-8 text-center"
                >
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5 px-3 py-0.5 bg-primary/10 rounded-full inline-block">Dawa-AR Detected</p>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Usage Instructions</h2>
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
          <div className="w-14 h-14" />

          {scanMode !== "barcode" ? (
             <motion.button
               whileTap={{ scale: 0.95 }}
               onClick={capture}
               disabled={!streaming}
               className="flex items-center justify-center w-[84px] h-[84px] rounded-full border-[4px] border-white/70 bg-transparent disabled:opacity-40"
             >
               <motion.div 
                 whileTap={{ scale: 0.88 }}
                 className="w-[66px] h-[66px] rounded-full bg-white shadow-inner flex items-center justify-center"
               />
             </motion.button>
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
            <label onClick={triggerNativeUpload} className="flex items-center justify-center w-14 h-14 rounded-full bg-white/10 backdrop-blur-2xl border border-white/10 text-white hover:bg-white/20 transition-all active:scale-90 cursor-pointer">
               <Upload size={22} />
               <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
        
        {scanMode !== "barcode" && (
           <p className="text-center text-[10px] font-bold uppercase tracking-wider text-white/40 mt-10">
             {t("scan.capture_hint")}
           </p>
        )}
      </div>
    </div>
  );
}
