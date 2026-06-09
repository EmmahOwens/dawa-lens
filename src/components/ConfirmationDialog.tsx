import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogPortal,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "@/lib/icons";
import { cn } from "@/lib/utils";

// ─── Animation constants ───────────────────────────────────────────────────

const springTransition = {
  type: "spring",
  bounce: 0.35,
  duration: 0.4,
} as const;

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: springTransition },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
} as const;

// ─── Props interface ───────────────────────────────────────────────────────

export interface ConfirmationDialogProps {
  /** Controls dialog visibility — parent owns this state */
  open: boolean;
  /** Called with false on cancel, overlay tap, or after confirm */
  onOpenChange: (open: boolean) => void;
  /** Dialog heading text */
  title: string;
  /** Body description text */
  description: string;
  /** Label for the confirm (destructive) button. Defaults to "Confirm" */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel" */
  cancelLabel?: string;
  /** Called when the confirm button is pressed */
  onConfirm: () => void | Promise<void>;
  /**
   * Optional list of items to display as a bulleted summary.
   * Used by the Clear All Data dialog to enumerate deleted data categories.
   */
  itemList?: string[];
  /**
   * Optional label rendered as a danger badge in the header.
   * e.g. "Irreversible" or "Permanent & Irreversible"
   */
  dangerBadgeLabel?: string;
  /**
   * "default"  — standard destructive dialog (Delete Record)
   * "critical" — destructive-tinted header region (Clear All Data)
   */
  variant?: "default" | "critical";
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  itemList,
  dangerBadgeLabel,
  variant = "default",
}: ConfirmationDialogProps) {
  // Close dialog first (optimistic), then await the callback.
  // If onConfirm throws, the error propagates to the parent's existing try/catch.
  const handleConfirm = async () => {
    onOpenChange(false);
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Custom overlay with blur */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content shell — Radix positions this centered */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%]",
            "rounded-3xl border-none bg-background p-0 overflow-hidden shadow-2xl",
            "focus:outline-none"
          )}
          // Disable Radix's built-in close-on-overlay-click so our onOpenChange
          // handles it; Radix fires onOpenChange(false) on Escape + overlay click.
        >
          <AnimatePresence>
            {open && (
              <motion.div
                key="confirmation-dialog-content"
                variants={dialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* ── Header region ── */}
                <div
                  className={cn(
                    "flex flex-col items-center text-center px-6 pt-8 pb-5",
                    variant === "critical" && "bg-destructive/10"
                  )}
                >
                  {/* Icon circle */}
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-background shadow">
                    <Trash2 size={28} className="text-destructive" />
                  </div>

                  {/* Title */}
                  <DialogTitle className="text-xl font-black tracking-tight text-foreground mb-2">
                    {title}
                  </DialogTitle>

                  {/* Danger badge */}
                  {dangerBadgeLabel && (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-destructive border border-destructive/20">
                      {dangerBadgeLabel}
                    </span>
                  )}
                </div>

                {/* ── Body region ── */}
                <div className="px-6 pb-6 space-y-5">
                  {/* Description */}
                  <DialogDescription className="text-center text-sm text-muted-foreground leading-relaxed">
                    {description}
                  </DialogDescription>

                  {/* Optional item list */}
                  {itemList && itemList.length > 0 && (
                    <ul className="space-y-2 rounded-2xl border border-border/50 bg-muted/30 p-4">
                      {itemList.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2.5 text-sm font-medium text-foreground"
                        >
                          <Trash2
                            size={13}
                            className="shrink-0 text-destructive/60"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* ── Footer ── */}
                  <div className="flex flex-col gap-3 pt-1">
                    <Button
                      variant="destructive"
                      className="w-full rounded-2xl font-black uppercase tracking-widest text-[11px] h-12"
                      onClick={handleConfirm}
                    >
                      {confirmLabel}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl font-black uppercase tracking-widest text-[11px] h-12"
                      onClick={() => onOpenChange(false)}
                    >
                      {cancelLabel}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
