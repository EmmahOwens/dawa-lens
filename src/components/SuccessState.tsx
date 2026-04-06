import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface SuccessStateProps {
  title: string;
  subtitle?: string;
}

export default function SuccessState({ title, subtitle }: SuccessStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20,
          delay: 0.1 
        }}
        className="mb-8 flex h-40 w-40 items-center justify-center rounded-full bg-success/10"
      >
        <motion.div
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-success text-success-foreground shadow-xl shadow-success/30"
        >
          <Check size={48} strokeWidth={4} />
        </motion.div>
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mb-3 text-3xl font-black tracking-tight text-foreground"
      >
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="max-w-[280px] text-lg text-muted-foreground leading-relaxed"
        >
          {subtitle}
        </motion.p>
      )}

      {/* Decorative background energy */}
      <div className="absolute inset-x-0 bottom-0 top-1/2 -z-10 bg-gradient-to-t from-success/10 to-transparent opacity-50" />
    </motion.div>
  );
}
