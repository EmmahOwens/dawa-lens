import React from 'react';
import { Rocket, ArrowRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StoreUpdateModalProps {
  currentVersion: string;
  newVersion: string;
  downloadUrl: string;
  onClose: () => void;
}

const StoreUpdateModal: React.FC<StoreUpdateModalProps> = ({ currentVersion, newVersion, downloadUrl, onClose }) => {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md" 
        onClick={onClose}
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
              animate={{ 
                rotate: [3, -3, 3],
                y: [0, -10, 0]
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 4,
                ease: "easeInOut"
              }}
              className="w-20 h-20 bg-primary text-primary-foreground rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-primary/40"
            >
                <Rocket className="w-10 h-10" />
            </motion.div>
            
            <h3 className="text-2xl font-black text-foreground mb-2 tracking-tight">New Update Live!</h3>
            
            <div className="flex items-center gap-3 mb-6 bg-muted px-4 py-2 rounded-2xl border border-border">
                <span className="text-xs font-bold text-muted-foreground font-mono">{currentVersion}</span>
                <ArrowRight className="w-3 h-3 text-primary" />
                <span className="text-xs font-black text-primary font-mono">{newVersion}</span>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed mb-8 font-medium">
                A new version is available with improvements and new features. Update now to stay synced!
            </p>

            <div className="w-full space-y-3">
                <a 
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group"
                >
                    <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                    <span>Download v{newVersion}</span>
                </a>
                
                <button 
                    onClick={onClose}
                    className="w-full py-3 rounded-2xl text-muted-foreground font-bold hover:bg-muted transition-colors text-xs uppercase tracking-widest"
                >
                    Maybe Later
                </button>
            </div>
        </div>
        
        {/* Decorative corner */}
        <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
      </motion.div>
    </div>
  );
};

export default StoreUpdateModal;
