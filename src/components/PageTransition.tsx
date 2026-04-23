import { Capacitor } from "@capacitor/core";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const isIOS = Capacitor.getPlatform() === 'ios';

  const variants = isIOS ? {
    initial: { x: "100%", opacity: 0.9 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "-30%", opacity: 0.9 }
  } : {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 1.05, y: 0 }
  };

  const transition = isIOS ? {
    type: "spring" as const,
    stiffness: 400,
    damping: 40,
    mass: 1
  } : {
    duration: 0.25,
    ease: [0.4, 0, 0.2, 1] as const
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={transition}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
