import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon, X } from "lucide-react";
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm rounded-[2.5rem] border border-border/50 bg-card p-8 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute right-6 top-6 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary mx-auto">
              <Icon size={40} />
            </div>

            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold tracking-tight mb-2">{title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleConfirm}
                className="h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20"
              >
                Allow {permissionName}
              </Button>
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="h-14 rounded-2xl text-muted-foreground font-medium"
              >
                Maybe later
              </Button>
            </div>

            <p className="mt-6 text-center text-[10px] text-muted-foreground uppercase tracking-widest font-medium opacity-50">
              Native System Request follows
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
