import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, X, SwitchCamera, Zap, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [capturing, setCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

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
    } catch {
      // camera unavailable
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
    // Navigate to results with captured image
    setTimeout(() => {
      navigate("/results", { state: { imageUrl: dataUrl } });
    }, 400);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      navigate("/results", { state: { imageUrl: reader.result as string } });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative min-h-screen bg-foreground">
      {/* Camera view */}
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlay */}
        {streaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-56 h-56 rounded-3xl border-2 border-primary/70"
            >
              <motion.div
                className="absolute left-0 right-0 h-0.5 bg-primary/80"
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          </div>
        )}

        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card">
            <Camera size={48} className="text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Camera loading...</p>
          </div>
        )}

        {/* Flash indicator */}
        {capturing && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-primary-foreground"
          />
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/95 to-transparent pt-16 pb-8 px-6 safe-bottom">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-foreground/10"
          >
            <X size={22} className="text-primary-foreground" />
          </button>

          <button
            onClick={capture}
            disabled={!streaming}
            className="flex items-center justify-center w-18 h-18 rounded-full border-4 border-primary-foreground/60 bg-primary transition-transform active:scale-90 disabled:opacity-40"
            style={{ width: 72, height: 72 }}
          >
            <Zap size={28} className="text-primary-foreground" />
          </button>

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
        <p className="text-center text-xs text-primary-foreground/60 mt-4">
          Position the pill inside the frame and tap to capture
        </p>
      </div>
    </div>
  );
}
