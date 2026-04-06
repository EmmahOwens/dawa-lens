import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, XCircle, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  type?: "critical" | "warning" | "error";
  actionText?: string;
  onAction?: () => void;
}

export default function ErrorDialog({
  open,
  onOpenChange,
  title,
  description,
  type = "error",
  actionText = "Try Again",
  onAction
}: ErrorDialogProps) {
  const Icon = type === "critical" ? ShieldAlert : type === "warning" ? AlertCircle : XCircle;
  const colorClass = type === "critical" ? "text-destructive" : type === "warning" ? "text-warning" : "text-destructive";
  const bgClass = type === "critical" ? "bg-destructive/10" : type === "warning" ? "bg-warning/10" : "bg-destructive/10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] border-none bg-background p-0 overflow-hidden rounded-[2rem] shadow-2xl">
        <div className={`p-8 pb-4 flex flex-col items-center text-center ${bgClass}`}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className={`mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-background shadow-sm`}
          >
            <Icon size={40} className={colorClass} />
          </motion.div>
          <DialogTitle className="text-2xl font-black tracking-tight text-foreground">{title}</DialogTitle>
        </div>
        
        <div className="px-8 pt-4 pb-8 space-y-6">
          <DialogDescription className="text-center text-lg leading-relaxed text-muted-foreground font-medium">
            {description}
          </DialogDescription>
          
          <DialogFooter className="flex-col sm:flex-col gap-3">
            <Button 
              size="lg" 
              variant={type === "warning" ? "default" : "destructive"} 
              className="w-full h-14 rounded-full text-lg font-bold shadow-lg shadow-destructive/20"
              onClick={() => {
                onAction?.();
                onOpenChange(false);
              }}
            >
              {actionText}
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full h-14 rounded-full text-lg font-medium border-border"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
