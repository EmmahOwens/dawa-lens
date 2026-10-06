import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon, X } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { NativeService } from "@/services/nativeService";
import { ImpactStyle } from "@capacitor/haptics";

interface PermissionRequestProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  icon: LucideIcon;
  permissionName: string;
}

export default function PermissionRequest({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  icon: Icon,
  permissionName
}: PermissionRequestProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    NativeService.haptics.impact(ImpactStyle.Heavy);
    onConfirm();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm rounded-[20px] border border-border bg-card p-6 sm:p-7 shadow-2xl z-10"
          >
            <button
              onClick={onClose}
              className="absolute right-5 top-5 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>

            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#f5f5f7] dark:bg-[#272729] border border-border text-primary mx-auto">
              <Icon size={26} />
            </div>

            <div className="text-center mb-6">
              <h3 className="text-xl font-bold tracking-[-0.022em] text-foreground mb-1.5">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {description}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <Button 
                onClick={handleConfirm}
                className="h-11 rounded-full text-sm font-semibold active:scale-95 transition-transform"
              >
                Allow {permissionName}
              </Button>
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="h-11 rounded-full text-xs text-muted-foreground font-semibold hover:bg-muted/50 active:scale-95 transition-transform"
              >
                Maybe later
              </Button>
            </div>

            <p className="mt-5 text-center text-[10px] text-muted-foreground uppercase tracking-wider font-semibold opacity-60">
              Native System Request follows
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
