import { useEffect, useState } from "react";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { Capacitor } from "@capacitor/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Download, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface UpdateInfo {
  version?: string;
  id?: string;
}

export const UpdateManager = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Listen for available updates
    const availableListener = CapacitorUpdater.addListener('updateAvailable', (info: UpdateInfo) => {
      console.log('Capgo: Update available', info);
      setUpdateInfo(info);
      setShowDialog(true);
    });

    // Listen for download progress
    const progressListener = CapacitorUpdater.addListener('downloadProgress', (info: { percent: number }) => {
      setDownloadProgress(info.percent);
    });

    // Listen for download completion
    const completeListener = CapacitorUpdater.addListener('downloadComplete', (info: { version?: string; id?: string }) => {
      console.log('Capgo: Download complete', info);
      setIsDownloading(false);
      setIsReady(true);
    });

    return () => {
      availableListener.then(l => l.remove());
      progressListener.then(l => l.remove());
      completeListener.then(l => l.remove());
    };
  }, []);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      // The plugin handles the download automatically if autoUpdate is true,
      // but we can also trigger it manually if needed.
      toast.info("Downloading update...");
    } catch (err) {
      console.error("Failed to start download:", err);
      setIsDownloading(false);
    }
  };

  const handleReload = async () => {
    try {
      toast.success("Applying update, restarting app...");
      // Small delay to let the toast be seen
      setTimeout(async () => {
        await CapacitorUpdater.set({ id: updateInfo?.version || updateInfo?.id });
      }, 1000);
    } catch (err) {
      console.error("Failed to apply update:", err);
      toast.error("Failed to apply update. Please try again later.");
    }
  };

  if (!showDialog) return null;

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md border-primary/20 bg-background/95 backdrop-blur-xl rounded-3xl overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />

        <DialogHeader className="relative z-10 pt-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            {isReady ? <CheckCircle2 size={24} /> : <Sparkles size={24} />}
          </div>
          <DialogTitle className="text-center text-2xl font-bold tracking-tight">
            {isReady ? "Update Ready!" : "New Update Available"}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground mt-2">
            {isReady
              ? "A fresh version of Dawa Lens is ready to be applied. Restart now to see what's new."
              : "We've improved Dawa Lens with new features and bug fixes. Download the update now."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 relative z-10">
          {isDownloading ? (
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">
                <span>Downloading...</span>
                <span>{Math.round(downloadProgress)}%</span>
              </div>
              <Progress value={downloadProgress} className="h-2" />
            </div>
          ) : isReady ? (
            <div className="p-4 rounded-2xl bg-success/5 border border-success/20 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-success/10 text-success mt-0.5">
                <CheckCircle2 size={14} />
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                The update has been downloaded securely. Restarting will apply all improvements instantly.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/50">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <RefreshCw size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold">Version {updateInfo?.version || "Latest"}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter opacity-60">Over-the-Air Update</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="relative z-10 sm:justify-center gap-3">
          {!isReady && !isDownloading && (
            <Button
              className="w-full rounded-2xl h-12 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/10"
              onClick={handleDownload}
            >
              <Download size={14} className="mr-2" /> Download Update
            </Button>
          )}
          {isReady && (
            <Button
              className="w-full rounded-2xl h-12 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/10"
              onClick={handleReload}
            >
              <RefreshCw size={14} className="mr-2" /> Restart & Apply
            </Button>
          )}
          {!isDownloading && (
            <Button
              variant="ghost"
              className="w-full text-[10px] font-bold uppercase tracking-widest opacity-60"
              onClick={() => setShowDialog(false)}
            >
              Maybe Later
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
