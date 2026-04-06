import { motion, AnimatePresence } from "framer-motion";
import { Droplets, Clock, Utensils, AlertCircle, Info } from "lucide-react";

export type ARInstructionType = "water" | "food" | "timed" | "warning";

interface ARInstructionProps {
  type: ARInstructionType;
  label: string;
  delay?: number;
}

export const ARInstruction = ({ type, label, delay = 0 }: ARInstructionProps) => {
  const getIcon = () => {
    switch (type) {
      case "water": return <Droplets className="text-blue-400" size={32} />;
      case "food": return <Utensils className="text-orange-400" size={32} />;
      case "timed": return <Clock className="text-green-400" size={32} />;
      case "warning": return <AlertCircle className="text-red-400" size={32} />;
      default: return <Info className="text-primary" size={32} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ 
        opacity: [0.7, 1, 0.7], 
        scale: 1, 
        y: [0, -10, 0],
        rotateX: [0, 10, 0],
        rotateY: [0, 10, 0]
      }}
      transition={{ 
        duration: 3, 
        repeat: Infinity, 
        ease: "easeInOut",
        delay 
      }}
      className="flex flex-col items-center justify-center p-4 rounded-full bg-foreground/20 backdrop-blur-xl border border-primary/30 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] w-28 h-28"
    >
      <div className="mb-2 filter drop-shadow-[0_0_8px_currentColor]">{getIcon()}</div>
      <p className="text-[10px] font-bold text-primary uppercase tracking-tighter text-center leading-tight">
        {label}
      </p>
      
      {/* Holographic light effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-t from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute -bottom-2 w-12 h-1 bg-primary/40 blur-md rounded-full" />
    </motion.div>
  );
};

export const ARInstructionOverlay = ({ instructions }: { instructions: ARInstructionType[] }) => {
  return (
    <div className="flex flex-wrap justify-center gap-6 p-10">
       <AnimatePresence>
         {instructions.map((ins, idx) => (
           <ARInstruction key={ins + idx} type={ins} label={ins.replace("_", " ")} delay={idx * 0.5} />
         ))}
       </AnimatePresence>
    </div>
  );
};
