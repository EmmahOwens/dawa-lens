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
        className="w-full max-w-md overflow-hidden rounded-[20px] bg-card border border-border shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#f5f5f7] dark:bg-[#272729] border border-border text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-[-0.022em] text-foreground leading-tight">
                Community Verification
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{pharmacy.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:scale-95 transition-transform"
          >
            <CloseSquare className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Action Type Selector */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              What would you like to verify?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFeedbackType("confirm_location")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-full border text-xs font-semibold transition-all active:scale-95 ${
                  feedbackType === "confirm_location"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <Location className="size-3.5 shrink-0" />
                <span>Confirm Location</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedbackType("wrong_location")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-full border text-xs font-semibold transition-all active:scale-95 ${
                  feedbackType === "wrong_location"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
                    : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Wrong Coordinates</span>
              </button>
            </div>
          </div>

          {/* GPS Pin Capture */}
          <div className="p-4 rounded-[16px] bg-muted/30 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Pin Live GPS Ground Truth</span>
              {verifiedCoords ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
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
              className="w-full h-10 rounded-full font-semibold gap-2 text-xs border-border active:scale-95 transition-transform"
            >
              {isLocating ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin text-primary" />
                  <span>Locking Satellites…</span>
                </>
              ) : (
                <>
                  <Crosshair className="size-3.5 text-primary" />
                  <span>{verifiedCoords ? "Re-pin Current GPS" : "I'm Here — Pin My GPS"}</span>
                </>
              )}
            </Button>
          </div>

          {/* Optional Phone Number Update */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
              Contact Phone (Optional)
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-3 size-4 text-muted-foreground" />
              <Input
                type="tel"
                value={suggestedPhone}
                onChange={(e) => setSuggestedPhone(e.target.value)}
                placeholder="e.g. +256 700 000 000"
                className="pl-11 h-11 rounded-full text-xs"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
              Landmark or Operating Details (Optional)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Opposite Shell petrol station, open 24/7"
              className="h-11 rounded-full text-xs"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 h-11 rounded-full text-xs font-semibold active:scale-95 transition-transform"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 active:scale-95 transition-transform"
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
