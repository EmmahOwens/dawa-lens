import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Camera,
  X,
  SwitchCamera,
  Zap,
  Upload,
  FileText,
} from "@/lib/icons";
import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import {
  Camera as CapCamera,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera";
import PermissionRequest from "@/components/PermissionRequest";
import { NativeService } from "@/services/nativeService";
import { EDITORIAL_EASE } from "@/components/editorial/EditorialPrimitives";

export default function ScanPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [capturing, setCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const hasFiredRef = useRef(false);

  const scanMode = "text" as const;

  /** Downscales an image data-URL to max 800px on longest side at 75% quality. */
  const downscaleImage = (dataUrl: string, maxPx = 800, quality = 0.75): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const toggleFlashlight = useCallback(async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
          torch?: boolean;
        }
        const capabilities = track.getCapabilities() as ExtendedMediaTrackCapabilities;
        if (capabilities.torch) {
          interface ExtendedMediaTrackConstraints extends MediaTrackConstraints {
            advanced?: Array<MediaTrackConstraintSet & { torch?: boolean }>;
          }
          await track.applyConstraints({
            advanced: [{ torch: !flashlightOn }],
          } as ExtendedMediaTrackConstraints);
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
      setShowPermissionModal(true);
    }
  }, [facingMode]);

  const switchCamera = useCallback(() => {
    setStreaming(false);
    setFacingMode((m) => (m === "environment" ? "user" : "environment"));
  }, []);

  useEffect(() => {
    if (hasFiredRef.current) {
      startCamera();
    } else {
      hasFiredRef.current = true;
      startCamera();
    }

    return () => {
      streamRef.current?.getTracks().forEach((tk) => tk.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const handleRequestPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await CapCamera.requestPermissions();
        if (status.camera === "granted") {
          setShowPermissionModal(false);
          startCamera();
        } else {
          navigate(-1);
        }
      } catch (e) {
        console.error("Permission request failed:", e);
        setShowPermissionModal(false);
        startCamera();
      }
    } else {
      setShowPermissionModal(false);
      startCamera();
    }
  };

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const dataUrl = await downscaleImage(rawDataUrl);

    navigate("/results", { state: { imageUrl: dataUrl, mode: scanMode } });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 70,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
        });
        if (image.dataUrl) {
          const scaled = await downscaleImage(image.dataUrl);
          navigate("/results", {
            state: { imageUrl: scaled, mode: scanMode },
          });
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
      navigate("/results", {
        state: { imageUrl: reader.result as string, mode: scanMode },
      });
    };
    reader.readAsDataURL(file);
  };

  const triggerNativeUpload = (e: React.MouseEvent) => {
    if (Capacitor.isNativePlatform()) {
      e.preventDefault();
      handleFileUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <div className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#060709] flex flex-col items-center select-none">
      {/* Top Floating Liquid-Glass Telemetry HUD */}
      <div className="absolute top-0 left-0 right-0 z-50 pt-[max(1.25rem,env(safe-area-inset-top))] px-4 sm:px-6 pb-6 bg-gradient-to-b from-black/85 via-black/40 to-transparent">
        <div className="flex items-center justify-between gap-4 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Close scanner"
            className="editorial-glass-dark flex items-center justify-center w-11 h-11 rounded-full text-white hover:bg-white/10 transition-colors active:scale-95"
          >
            <X size={19} />
          </button>

          <div className="editorial-glass-dark flex items-center justify-center gap-2.5 px-5 h-11 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <FileText size={14} strokeWidth={2} className="text-white/85" />
            <span className="editorial-mono text-[10px] text-white">
              {t("scan.text")} · Optical OCR
            </span>
          </div>

          <button
            type="button"
            onClick={toggleFlashlight}
            aria-label={flashlightOn ? "Turn off flashlight" : "Turn on flashlight"}
            className={`flex items-center justify-center w-11 h-11 rounded-full transition-all active:scale-95 ${
              flashlightOn
                ? "bg-white text-[#060709] shadow-[0_0_24px_rgba(255,255,255,0.45)]"
                : "editorial-glass-dark text-white hover:bg-white/10"
            }`}
          >
            <Zap size={18} set={flashlightOn ? "bold" : "light"} />
          </button>
        </div>
      </div>

      {/* Centered Live Camera Optical Stage */}
      <div className="flex-1 w-full max-w-2xl bg-black relative self-center overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Architectural Optical Reticle */}
        {streaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: EDITORIAL_EASE }}
              className="relative w-[78%] sm:w-[62%] md:w-[52%] aspect-square max-w-xs sm:max-w-sm md:max-w-md"
            >
              {/* Subtle composite-only optical scan line */}
              <div className="absolute inset-x-2 top-[5%] bottom-[5%] overflow-hidden pointer-events-none z-30">
                <motion.div
                  className="h-full w-full"
                  animate={{ y: ["0%", "96%", "0%"] }}
                  transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }}
                >
                  <div className="h-[1.5px] w-full bg-gradient-to-r from-transparent via-white/90 to-transparent shadow-[0_0_12px_rgba(255,255,255,0.55)]" />
                </motion.div>
              </div>

              {/* Hairline frame border */}
              <div className="absolute inset-0 border border-white/15 rounded-[26px]" />

              {/* Precision Optical Corner Brackets */}
              <div className="absolute -top-px -left-px w-9 h-9 border-t-2 border-l-2 border-white rounded-tl-[26px]" />
              <div className="absolute -top-px -right-px w-9 h-9 border-t-2 border-r-2 border-white rounded-tr-[26px]" />
              <div className="absolute -bottom-px -left-px w-9 h-9 border-b-2 border-l-2 border-white rounded-bl-[26px]" />
              <div className="absolute -bottom-px -right-px w-9 h-9 border-b-2 border-r-2 border-white rounded-br-[26px]" />

              {/* Center crosshair micro-tick */}
              <div className="absolute inset-0 flex items-center justify-center opacity-35">
                <div className="w-4 h-px bg-white" />
                <div className="h-4 w-px bg-white absolute" />
              </div>

              <div className="absolute -bottom-11 left-0 right-0 flex justify-center">
                <span className="editorial-glass-dark rounded-full px-3.5 py-1 editorial-mono text-[9.5px] text-white/80">
                  Align Label or Blister Strip
                </span>
              </div>
            </motion.div>
          </div>
        )}

        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060709]/95 z-40 px-6 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              className="w-11 h-11 rounded-full border-2 border-white/15 border-t-white"
            />
            <p className="editorial-mono text-[10px] text-white/65 mt-5">
              {t("scan.camera_loading")}
            </p>
          </div>
        )}

        {capturing && (
          <motion.div
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0 bg-white z-50 pointer-events-none"
          />
        )}
      </div>

      {/* Bottom Precision Shutter & Controls Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#060709] via-[#060709]/85 to-transparent pt-20 sm:pt-28 pb-[max(2.25rem,env(safe-area-inset-bottom))] px-6 sm:px-10 z-30">
        <div className="flex items-center justify-between max-w-sm sm:max-w-md mx-auto">
          {/* Upload Pill (Left) */}
          <label
            onClick={triggerNativeUpload}
            className="editorial-glass-dark flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full text-white hover:bg-white/10 transition-colors active:scale-95 cursor-pointer"
          >
            <Upload size={19} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          {/* Machined Precision Shutter Button (Center) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onPointerDown={() => {
              if (streaming) void NativeService.haptics.impact();
            }}
            onClick={capture}
            disabled={!streaming}
            aria-label="Capture medication photo"
            className="flex items-center justify-center w-20 h-20 sm:w-[84px] sm:h-[84px] rounded-full border-[2.5px] border-white/80 bg-white/5 disabled:opacity-25 transition-opacity relative group"
          >
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="w-[62px] h-[62px] sm:w-[66px] sm:h-[66px] rounded-full bg-white shadow-[0_0_24px_rgba(255,255,255,0.28)] flex items-center justify-center transition-colors group-active:bg-white/80"
            >
              {capturing && (
                <motion.div
                  className="w-6 h-6 rounded-full border-2 border-[#060709] border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
              )}
            </motion.div>
          </motion.button>

          {/* Switch Camera Pill (Right) */}
          <button
            type="button"
            onClick={switchCamera}
            aria-label="Switch camera"
            className="editorial-glass-dark flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full text-white hover:bg-white/10 transition-colors active:scale-95"
          >
            <SwitchCamera size={19} />
          </button>
        </div>

        <p className="text-center editorial-mono text-[9.5px] text-white/50 mt-6">
          {t("scan.capture_hint")}
        </p>
      </div>

      <PermissionRequest
        isOpen={showPermissionModal}
        onClose={() => navigate("/")}
        onConfirm={handleRequestPermission}
        title="Camera Access"
        description="We need your camera to scan medicine labels and identify pills for interaction safety."
        icon={Camera}
        permissionName="Camera"
      />
    </div>
  );
}
