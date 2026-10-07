import React, { useState, useEffect, useRef } from 'react';
import { Rocket, ArrowRight, Download, CheckCircle, AlertTriangle, RefreshCw, ExternalLink } from "@/lib/icons";
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import AppUpdater from '@/plugins/app-updater';

interface StoreUpdateModalProps {
  currentVersion: string;
  newVersion: string;
  downloadUrl: string;
  sha256?: string;
  onClose: () => void;
}

type DownloadState = 'idle' | 'downloading' | 'installing' | 'error';

const StoreUpdateModal: React.FC<StoreUpdateModalProps> = ({ currentVersion, newVersion, downloadUrl, sha256, onClose }) => {
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const listenerRef = useRef<{ remove: () => Promise<void> } | null>(null);

  // In-app update overlay is only for native Android APK releases; never render on web or non-Android
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return null;
  }

  // Clean up listener on unmount
  useEffect(() => {
    return () => {
      listenerRef.current?.remove();
    };
  }, []);

  const handleDownload = async () => {
    // On web or non-Android platforms, fall back to browser download
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      await Browser.open({ url: downloadUrl });
      return;
    }

    try {
      setDownloadState('downloading');
      setProgress(0);
      setErrorMessage('');

      // Listen for download progress events from native plugin
      listenerRef.current = await AppUpdater.addListener('downloadProgress', (event) => {
        setProgress(event.percent);
        if (event.percent >= 100) {
          setDownloadState('installing');
        }
      });

      // Start download + install with integrity verification
      await AppUpdater.downloadAndInstall({ url: downloadUrl, sha256 });

      // If we get here, the install intent was launched
      setDownloadState('installing');
    } catch (err: unknown) {
      console.error('Update download failed:', err);
      setDownloadState('error');
      setErrorMessage((err as Error)?.message || 'Download failed. Please try again.');
    } finally {
      listenerRef.current?.remove();
      listenerRef.current = null;
    }
  };

  const handleBrowserDownload = async () => {
    try {
      await Browser.open({ url: downloadUrl });
    } catch (err) {
      console.error('Failed to open browser:', err);
      window.open(downloadUrl, '_blank');
    }
  };

  const getStatusText = () => {
    switch (downloadState) {
      case 'downloading':
        return progress < 100 ? `Downloading... ${progress}%` : 'Preparing install...';
      case 'installing':
        return 'Opening installer...';
      case 'error':
        return 'Retry In-App Download';
      default:
        return `Download v${newVersion}`;
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={downloadState === 'downloading' ? undefined : onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 15 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="relative bg-card border border-border w-full max-w-sm rounded-[20px] shadow-xl overflow-hidden flex flex-col"
      >
        <div className="p-7 flex flex-col items-center text-center">
            <div 
              className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 border transition-colors duration-300 ${
                downloadState === 'error'
                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                  : downloadState === 'installing'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}
            >
                {downloadState === 'error' ? (
                  <AlertTriangle className="w-7 h-7" />
                ) : downloadState === 'installing' ? (
                  <CheckCircle className="w-7 h-7" />
                ) : (
                  <Rocket className="w-7 h-7" />
                )}
            </div>
            
            <h3 className="text-xl font-bold text-foreground mb-1.5 tracking-tight">
              {downloadState === 'error' ? 'Update Failed' : downloadState === 'installing' ? 'Almost Done' : 'Software Update'}
            </h3>
            
            <div className="inline-flex items-center gap-2 mb-5 bg-muted/60 px-3 py-1 rounded-full border border-border">
                <span className="text-xs font-medium text-muted-foreground font-mono">{currentVersion}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-primary font-mono">{newVersion}</span>
            </div>

            {/* Progress bar — shown during download */}
            {downloadState === 'downloading' && (
              <div className="w-full mb-5">
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 font-mono">{progress}% complete</p>
              </div>
            )}

            <p className="text-muted-foreground text-xs leading-relaxed mb-6 font-medium">
              {downloadState === 'error'
                ? errorMessage
                : downloadState === 'installing'
                ? 'The installer will launch shortly. Follow the prompts to finish updating.'
                : 'A new version of Dawa Lens is available with performance and security enhancements.'}
            </p>

            <div className="w-full space-y-2.5">
                {downloadState === 'error' && (
                  <button
                    onClick={handleBrowserDownload}
                    className="w-full h-11 rounded-full font-semibold text-xs bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Download via Browser</span>
                  </button>
                )}

                <button 
                    onClick={downloadState === 'error' ? handleDownload : downloadState === 'idle' ? handleDownload : undefined}
                    disabled={downloadState === 'downloading' || downloadState === 'installing'}
                    className={`w-full h-11 rounded-full font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
                      downloadState === 'downloading' || downloadState === 'installing'
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : downloadState === 'error'
                        ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
                    }`}
                >
                    {downloadState === 'downloading' ? (
                      <motion.div
                        className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      />
                    ) : downloadState === 'error' ? (
                      <RefreshCw className="w-4 h-4" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>{getStatusText()}</span>
                </button>
                
                {downloadState !== 'downloading' && (
                  <button 
                      onClick={onClose}
                      className="w-full h-10 rounded-full text-muted-foreground font-semibold hover:bg-muted transition-colors text-xs active:scale-95"
                  >
                      {downloadState === 'installing' ? 'Close' : 'Later'}
                  </button>
                )}
            </div>
        </div>
      </motion.div>
    </div>
  );
};

export default StoreUpdateModal;
