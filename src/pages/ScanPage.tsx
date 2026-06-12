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
import { NativeCamera } from "@/plugins/nativeCamera";

export default function ScanPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [capturing, setCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  // Guard so the mount effect only fires once even if callbacks are recreated
  const hasFiredRef = useRef(false);

  const scanMode = "text" as const;

  /** Downscales an image data-URL to max 800px on longest side at 75% quality. */
  const downscaleImage = (dataUrl: string, maxPx = 800, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
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
      img.onerror = () => resolve(dataUrl); // fallback: send original
      img.src = dataUrl;
    });
  };

  // Start as `true` on native so the loading spinner is visible immediately
  // without waiting for any async bridge call.
  const [isNativeScanRunning, setIsNativeScanRunning] = useState(
    Capacitor.isNativePlatform()
  );
  const [showAR, setShowAR] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showWebScanner, setShowWebScanner] = useState(
    !Capacitor.isNativePlatform()
  );

  const isNative = Capacitor.isNativePlatform();

  const toggleFlashlight = useCallback(async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        interface ExtendedMediaTrackCapabilities
          extends MediaTrackCapabilities {
          torch?: boolean;
        }
        const capabilities =
          track.getCapabilities() as ExtendedMediaTrackCapabilities;
        if (capabilities.torch) {
          interface ExtendedMediaTrackConstraints
            extends MediaTrackConstraints {
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
    if (Capacitor.isNativePlatform() && !showWebScanner) return;
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
  }, [facingMode, showWebScanner]);

  const startNativeScan = useCallback(async () => {
    try {
      setIsNativeScanRunning(true);
      const result = await NativeCamera.startScan({ mode: scanMode });
      if (!result.cancelled && result.imageData) {
        navigate("/results", {
          state: { imageUrl: result.imageData, mode: scanMode },
        });
      } else {
        navigate(-1);
      }
    } catch (err) {
      console.warn(
        "[ScanPage] Native camera failed, using web fallback:",
        err
      );
      setIsNativeScanRunning(false);
      setShowWebScanner(true);
      startCamera();
    } finally {
      setIsNativeScanRunning(false);
    }
  }, [scanMode, navigate, startCamera]);

  useEffect(() => {
    // Guard: only run once on mount. Without this, recreating startCamera /
    // startNativeScan (e.g. when showWebScanner flips in the fallback path)
    // would re-trigger the effect and double-launch the scan.
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;

    if (Capacitor.isNativePlatform()) {
      // Skip the redundant CapCamera.checkPermissions() bridge call.
      // NativeScanActivity already handles its own permission check/request
      // internally, so the extra async round-trip here only adds latency.
      // If the user has permanently denied camera access, startNativeScan's
      // catch block will fall back to the web scanner gracefully.
      startNativeScan();
    } else {
      startCamera();
    }

    return () => {
      streamRef.current?.getTracks().forEach((tk) => tk.stop());
    };
  }, [startCamera, startNativeScan]);

  const handleRequestPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await CapCamera.requestPermissions();
        if (status.camera === "granted") {
          setShowPermissionModal(false);
          startNativeScan();
        } else {
          navigate(-1); // Go back if denied
        }
      } catch (e) {
        console.error("Permission request failed:", e);
        setShowPermissionModal(false);
        setShowWebScanner(true);
        startCamera();
      }
    } else {
      setShowPermissionModal(false);
      startCamera();
    }
  };

  const capture = async () => {
    if (Capacitor.isNativePlatform() && !showWebScanner) {
      try {
        setIsNativeScanRunning(true);
        const result = await NativeCamera.startScan({ mode: scanMode });
        if (!result.cancelled && result.imageData) {
          navigate("/results", {
            state: { imageUrl: result.imageData, mode: scanMode },
          });
        }
      } catch (err) {
        console.warn(
          "[ScanPage] Native camera failed, using web fallback:",
          err
        );
        setIsNativeScanRunning(false);
        setShowWebScanner(true);
        startCamera();
      } finally {
        setIsNativeScanRunning(false);
      }
      return;
    }

    if (!videoRef.current || !canvasRef.current) return;

    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    // Capture at native resolution first, then downscale to ≤800px to reduce AI token cost
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const dataUrl = await downscaleImage(rawDataUrl);

    navigate("/results", { state: { imageUrl: dataUrl, mode: scanMode } });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 70,  // reduced from 90 to limit token cost
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
      e.preventDefault(); // Stop the <input> from opening the Web file picker
      handleFileUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  };

  if (isNative && !showWebScanner) {
    // Full-screen black backdrop behind the native camera activity.
    // Using fixed positioning ensures it fills the screen regardless of
    // the parent's flex layout (PageTransition wraps in w-full h-full).
    return <div className="fixed inset-0 bg-black" />;
  }

  return (
    <div className="relative min-h-screen bg-foreground flex flex-col items-center">
      {/* Top App Bar with X, Mode Selector, and Flashlight */}
      <div className="absolute top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top,2rem)] px-4 sm:px-6 pb-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between gap-4 max-w-2xl mx-auto">
          {/* Top Left: Exit Button */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all active:scale-90"
          >
            <X size={20} />
          </button>

          {/* Center: Static mode label */}
          <div className="flex items-center justify-center gap-2 bg-white/10 backdrop-blur-xl px-4 sm:px-6 h-11 sm:h-12 rounded-full border border-white/10 shadow-2xl">
            <FileText size={16} strokeWidth={2.5} className="text-primary" />
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white">
              {t("scan.text")}
            </span>
          </div>

          {/* Top Right: Flashlight Toggle */}
          <button
            onClick={toggleFlashlight}
            className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full backdrop-blur-md border transition-all ${
              flashlightOn
                ? "bg-primary border-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                : "bg-white/10 border-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Zap size={20} set={flashlightOn ? "bold" : "light"} />
          </button>
        </div>
      </div>

      {/* Camera view — centred column on wide screens */}
      <div className="flex-1 w-full max-w-2xl bg-black relative self-center">
        {showWebScanner && (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
          />
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlays */}
        {showWebScanner && streaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative w-[80%] sm:w-[60%] md:w-[50%] aspect-square max-w-xs sm:max-w-sm md:max-w-md"
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
              <div className="absolute top-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-t-[3px] border-l-[3px] border-primary rounded-tl-3xl" />
              <div className="absolute top-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-t-[3px] border-r-[3px] border-primary rounded-tr-3xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-b-[3px] border-l-[3px] border-primary rounded-bl-3xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-b-[3px] border-r-[3px] border-primary rounded-br-3xl" />

              <p className="absolute -bottom-12 left-0 right-0 text-center text-[10px] sm:text-xs font-bold text-white/40 uppercase tracking-[0.3em]">
                Align Label
              </p>
            </motion.div>
          </div>
        )}

        {showWebScanner && !streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50">
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary"
            />
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-6">
              {t("scan.camera_loading")}
            </p>
          </div>
        )}

        {isNative && isNativeScanRunning && !showWebScanner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50">
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary"
            />
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-6">
              {t("scan.camera_loading")}
            </p>
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
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 text-center"
              >
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5 px-3 py-0.5 bg-primary/10 rounded-full inline-block">
                  Dawa-AR Detected
                </p>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Usage Instructions
                </h2>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent pt-24 sm:pt-32 pb-10 sm:pb-14 px-6 sm:px-10 safe-bottom z-30">
        <div className="flex items-center justify-between max-w-sm sm:max-w-md mx-auto">
          {/* Spacer matching the right-side buttons */}
          <div className="flex items-center gap-2 sm:gap-3 opacity-0 pointer-events-none">
            <div className="w-12 h-12 sm:w-14 sm:h-14" />
            <div className="w-12 h-12 sm:w-14 sm:h-14" />
          </div>

          {/* Shutter button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={capture}
            disabled={showWebScanner ? !streaming : false}
            className="flex items-center justify-center w-20 h-20 sm:w-[88px] sm:h-[88px] md:w-24 md:h-24 rounded-full border-[4px] border-white/40 bg-transparent disabled:opacity-20 transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)] relative group"
          >
            <motion.div
              whileTap={{ scale: 0.88 }}
              className="w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] md:w-[76px] md:h-[76px] rounded-full bg-white shadow-xl flex items-center justify-center group-active:bg-primary transition-colors"
            />
            <div className="absolute inset-[-8px] border border-white/5 rounded-full animate-pulse" />
          </motion.button>

          {/* Camera flip + upload */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() =>
                setFacingMode((m) =>
                  m === "environment" ? "user" : "environment"
                )
              }
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 backdrop-blur-2xl border border-white/10 text-white hover:bg-white/20 transition-all active:scale-90"
            >
              <SwitchCamera size={20} className="sm:hidden" />
              <SwitchCamera size={22} className="hidden sm:block" />
            </button>
            <label
              onClick={triggerNativeUpload}
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 backdrop-blur-2xl border border-white/10 text-white hover:bg-white/20 transition-all active:scale-90 cursor-pointer"
            >
              <Upload size={20} className="sm:hidden" />
              <Upload size={22} className="hidden sm:block" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        <p className="text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/40 mt-8 sm:mt-10">
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
