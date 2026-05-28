import { motion } from "framer-motion";
import RiveAnimation from "./rive/RiveAnimation";

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
      <div className="mb-8 h-48 w-48 relative">
        <RiveAnimation
          src="/assets/rive/success_state.riv"
          stateMachine="State Machine 1"
          autoplay={true}
        />
      </div>

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
