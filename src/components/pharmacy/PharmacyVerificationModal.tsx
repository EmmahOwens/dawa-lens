import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NdaPharmacy } from "@/services/pharmacyService";
import {
  submitPharmacyFeedback,
  PharmacyFeedbackSubmission,
} from "@/services/pharmacyFeedbackService";
import {
  ShieldCheck,
  Crosshair,
  CheckCircle,
  CloseSquare,
  AlertTriangle,
  RefreshCw,
  Phone,
  Location,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface PharmacyVerificationModalProps {
  pharmacy: NdaPharmacy;
  userCoords: [number, number];
  isOpen: boolean;
  onClose: () => void;
}

export const PharmacyVerificationModal: React.FC<PharmacyVerificationModalProps> = ({
  pharmacy,
  userCoords,
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const [feedbackType, setFeedbackType] = useState<PharmacyFeedbackSubmission["feedbackType"]>("confirm_location");
  const [isLocating, setIsLocating] = useState(false);
  const [verifiedCoords, setVerifiedCoords] = useState<[number, number] | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [suggestedPhone, setSuggestedPhone] = useState(pharmacy.phone || "");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCaptureLiveGps = () => {
    if (!navigator.geolocation) {
      setVerifiedCoords(userCoords);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setVerifiedCoords([pos.coords.longitude, pos.coords.latitude]);
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setIsLocating(false);
      },
      (err) => {
        console.warn("[PharmacyVerificationModal] GPS error:", err);
        setVerifiedCoords(userCoords);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await submitPharmacyFeedback({
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        currentLat: pharmacy.latitude,
        currentLng: pharmacy.longitude,
        verifiedLat: verifiedCoords ? verifiedCoords[1] : undefined,
        verifiedLng: verifiedCoords ? verifiedCoords[0] : undefined,
        gpsAccuracyMeters: gpsAccuracy ?? undefined,
        feedbackType,
        suggestedPhone: suggestedPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      toast({
        title: result.queued ? "Verification Saved Offline" : "Thank you for verifying!",
        description: result.queued
          ? "Your community location verification is saved and will sync automatically when back online."
          : "Your ground-truth location update helps improve pharmacy access across Uganda.",
      });

      onClose();
    } catch {
      toast({
        title: "Error submitting verification",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-card border border-border shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground leading-tight">
                Community Verification
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{pharmacy.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted active:scale-95"
          >
            <CloseSquare className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Action Type Selector */}
          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block">
              What would you like to verify?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFeedbackType("confirm_location")}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                  feedbackType === "confirm_location"
                    ? "bg-teal-500/15 border-teal-500/40 text-teal-700 dark:text-teal-300 shadow-sm"
                    : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <Location className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
                <span>Confirm Location</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedbackType("wrong_location")}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                  feedbackType === "wrong_location"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-sm"
                    : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Wrong Coordinates</span>
              </button>
            </div>
          </div>

          {/* GPS Pin Capture */}
          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Pin Live GPS Ground Truth</span>
              {verifiedCoords ? (
                <span className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="size-3.5" /> Pinned
                  {gpsAccuracy && ` (±${gpsAccuracy}m)`}
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              If you are physically standing at this pharmacy, tap to lock the exact coordinates.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCaptureLiveGps}
              disabled={isLocating}
              className="w-full h-9 rounded-xl font-bold gap-2 text-xs"
            >
              {isLocating ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin text-teal-600" />
                  <span>Locking Satellites…</span>
                </>
              ) : (
                <>
                  <Crosshair className="size-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{verifiedCoords ? "Re-pin Current GPS" : "I'm Here — Pin My GPS"}</span>
                </>
              )}
            </Button>
          </div>

          {/* Optional Phone Number Update */}
          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">
              Contact Phone (Optional)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="tel"
                value={suggestedPhone}
                onChange={(e) => setSuggestedPhone(e.target.value)}
                placeholder="e.g. +256 700 000 000"
                className="pl-9 h-10 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-foreground mb-1 block">
              Landmark or Operating Details (Optional)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Opposite Shell petrol station, open 24/7"
              className="h-10 rounded-xl text-xs"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs gap-1.5 shadow-md shadow-teal-600/20"
            >
              {isSubmitting ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle className="size-3.5" />
              )}
              <span>Submit Verification</span>
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
