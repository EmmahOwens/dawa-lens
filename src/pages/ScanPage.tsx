import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, SwitchCamera, Zap, Upload, Pill, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { ARInstructionOverlay, ARInstructionType } from "@/components/ui/ARInstruction";
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

export type ScanMode = "pill" | "text";

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
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
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
    } catch (err) {
      console.error("Camera access failed:", err);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    
    return () => {
      streamRef.current?.getTracks().forEach((tk) => tk.stop());
    };
  }, [startCamera]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    // AI Simulation with AR feedback
    setDetectedInstructions(["water", "timed", "food"]);
    setShowAR(true);
    
    setTimeout(() => {
      navigate("/results", { state: { imageUrl: dataUrl, mode: scanMode } });
    }, 3000); 
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
          <div className="flex bg-white/5 backdrop-blur-xl p-1 rounded-full border border-white/10 shadow-2xl relative overflow-hidden h-11 w-48">
            <AnimatePresence mode="popLayout">
              {["pill", "text"].map((mode) => {
                const active = scanMode === mode;
                const Icon = mode === "pill" ? Pill : FileText;
                
                return (
                  <button
                    key={mode}
                    onClick={() => setScanMode(mode as ScanMode)}
                    className={`relative flex-1 flex items-center justify-center gap-2 rounded-full transition-all duration-500 z-10 ${active ? "text-primary-foreground" : "text-white/40 hover:text-white"}`}
                  >
                    {active && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute inset-0 bg-primary rounded-full -z-10 shadow-lg shadow-primary/40"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}
                      />
                    )}
                    <Icon size={16} strokeWidth={active ? 3 : 2} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t(`scan.${mode}`)}</span>
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
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlays */}
        {streaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative w-[85%] aspect-square max-w-sm"
            >
               {/* Animated scanning line */}
               <motion.div 
                 className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent z-30 shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]"
                 animate={{ top: ["5%", "95%", "5%"] }}
                 transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
               />

               <div className="absolute inset-0 border-[0.5px] border-white/10 rounded-3xl overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5" />
               </div>

               {/* Corners */}
               <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-primary rounded-tl-3xl" />
               <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-primary rounded-tr-3xl" />
               <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-primary rounded-bl-3xl" />
               <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-primary rounded-br-3xl" />

               <p className="absolute -bottom-12 left-0 right-0 text-center text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">
                 {scanMode === "pill" ? "Center Medicine" : "Align Label"}
               </p>
            </motion.div>
          </div>
        )}


        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50">
            <motion.div 
               animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
               transition={{ duration: 2, repeat: Infinity }}
               className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary"
            />
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-6">{t("scan.camera_loading")}</p>
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

           <motion.button
             whileTap={{ scale: 0.95 }}
             onClick={capture}
             disabled={!streaming}
             className="flex items-center justify-center w-[88px] h-[88px] rounded-full border-[4px] border-white/40 bg-transparent disabled:opacity-20 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] relative group"
           >
             <motion.div 
               whileTap={{ scale: 0.88 }}
               className="w-[68px] h-[68px] rounded-full bg-white shadow-xl flex items-center justify-center group-active:bg-primary transition-colors"
             />
             <div className="absolute inset-[-8px] border border-white/5 rounded-full animate-pulse" />
           </motion.button>

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
        
        <p className="text-center text-[10px] font-bold uppercase tracking-wider text-white/40 mt-10">
          {t("scan.capture_hint")}
        </p>
      </div>
    </div>
  );
}
