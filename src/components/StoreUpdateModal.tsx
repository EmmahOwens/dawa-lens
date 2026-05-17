import React, { useState, useEffect, useRef } from 'react';
import { Rocket, ArrowRight, Download, CheckCircle, AlertTriangle } from "@/lib/icons";
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import AppUpdater from '@/plugins/app-updater';

interface StoreUpdateModalProps {
  currentVersion: string;
  newVersion: string;
  downloadUrl: string;
  onClose: () => void;
}

type DownloadState = 'idle' | 'downloading' | 'installing' | 'error';

const StoreUpdateModal: React.FC<StoreUpdateModalProps> = ({ currentVersion, newVersion, downloadUrl, onClose }) => {
  const [downloadState, setDownloadState] = useState<DownloadState>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const listenerRef = useRef<{ remove: () => Promise<void> } | null>(null);

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

      // Start download + install
      await AppUpdater.downloadAndInstall({ url: downloadUrl });

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

  const getStatusText = () => {
    switch (downloadState) {
      case 'downloading':
        return progress < 100 ? `Downloading... ${progress}%` : 'Preparing install...';
      case 'installing':
        return 'Opening installer...';
      case 'error':
        return 'Download Failed';
      default:
        return `Download v${newVersion}`;
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md" 
        onClick={downloadState === 'downloading' ? undefined : onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-card border border-border w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/20 to-transparent -z-10"></div>
        
        <div className="p-8 flex flex-col items-center text-center">
            <motion.div 
              animate={
                downloadState === 'downloading'
                  ? { rotate: 0, y: [0, -4, 0] }
                  : { rotate: [3, -3, 3], y: [0, -10, 0] }
              }
              transition={{ 
                repeat: Infinity, 
                duration: downloadState === 'downloading' ? 1.5 : 4,
                ease: "easeInOut"
              }}
              className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl transition-colors duration-300 ${
                downloadState === 'error'
                  ? 'bg-destructive text-destructive-foreground shadow-destructive/40'
                  : downloadState === 'installing'
                  ? 'bg-green-500 text-white shadow-green-500/40'
                  : 'bg-primary text-primary-foreground shadow-primary/40'
              }`}
            >
                {downloadState === 'error' ? (
                  <AlertTriangle className="w-10 h-10" />
                ) : downloadState === 'installing' ? (
                  <CheckCircle className="w-10 h-10" />
                ) : (
                  <Rocket className="w-10 h-10" />
                )}
            </motion.div>
            
            <h3 className="text-2xl font-black text-foreground mb-2 tracking-tight">
              {downloadState === 'error' ? 'Update Failed' : downloadState === 'installing' ? 'Almost Done!' : 'New Update Live!'}
            </h3>
            
            <div className="flex items-center gap-3 mb-6 bg-muted px-4 py-2 rounded-2xl border border-border">
                <span className="text-xs font-bold text-muted-foreground font-mono">{currentVersion}</span>
                <ArrowRight className="w-3 h-3 text-primary" />
                <span className="text-xs font-black text-primary font-mono">{newVersion}</span>
            </div>

            {/* Progress bar — shown during download */}
            {downloadState === 'downloading' && (
              <div className="w-full mb-6">
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 font-mono">{progress}% complete</p>
              </div>
            )}

            <p className="text-muted-foreground text-sm leading-relaxed mb-8 font-medium">
              {downloadState === 'error'
                ? errorMessage
                : downloadState === 'installing'
                ? 'The install prompt should appear shortly. Follow the on-screen instructions to complete the update.'
                : 'A new version is available with improvements and new features. Update now to stay synced!'}
            </p>

            <div className="w-full space-y-3">
                <button 
                    onClick={downloadState === 'error' ? handleDownload : downloadState === 'idle' ? handleDownload : undefined}
                    disabled={downloadState === 'downloading' || downloadState === 'installing'}
                    className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 group ${
                      downloadState === 'downloading' || downloadState === 'installing'
                        ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                        : downloadState === 'error'
                        ? 'bg-destructive text-destructive-foreground shadow-destructive/20 hover:scale-[1.02] active:scale-95'
                        : 'bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02] active:scale-95'
                    }`}
                >
                    {downloadState === 'downloading' ? (
                      <motion.div
                        className="w-5 h-5 border-2 border-muted-foreground border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      />
                    ) : (
                      <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                    )}
                    <span>{getStatusText()}</span>
                </button>
                
                {downloadState !== 'downloading' && (
                  <button 
                      onClick={onClose}
                      className="w-full py-3 rounded-2xl text-muted-foreground font-bold hover:bg-muted transition-colors text-xs uppercase tracking-widest"
                  >
                      {downloadState === 'installing' ? 'Close' : 'Maybe Later'}
                  </button>
                )}
            </div>
        </div>
        
        {/* Decorative corner */}
        <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
      </motion.div>
    </div>
  );
};

export default StoreUpdateModal;
