import { motion, type Transition } from "framer-motion";
import { BouncingPillsLoader } from "./BouncingPillsLoader";
import { LOGO_BASE64 } from "@/lib/logoBase64";

interface PageLoaderProps {
  /** "full" renders a full-screen overlay with backdrop blur (default).
   *  "inline" renders only the pill animation — useful inside cards/panels. */
  variant?: "full" | "inline";
  /** Optional descriptive label shown below the animation (full variant only). */
  label?: string;
}

const ROUTE_LOADER_MEDIA: Array<{
  prefix: string;
  image: string;
  alt: string;
  label: string;
}> = [
  {
    prefix: "/family",
    image: "/assets/screens/family-hub.webp",
    alt: "Family Hub care preview",
    label: "Opening Family Hub...",
  },
  {
    prefix: "/medvault",
    image: "/assets/screens/med-vault.webp",
    alt: "Med Vault inventory preview",
    label: "Opening Med Vault...",
  },
  {
    prefix: "/travel",
    image: "/assets/screens/travel-companion.webp",
    alt: "Travel Companion preview",
    label: "Opening Travel Companion...",
  },
];

function getRouteMedia(pathname: string) {
  return ROUTE_LOADER_MEDIA.find((entry) => pathname.startsWith(entry.prefix));
}

// ─── Decorative premium scanning laser line ─────────────────────────────────
function ScanBeam() {
  return (
    <motion.div
      aria-hidden
      animate={{ 
        top: ["5%", "95%", "5%"],
        opacity: [0.3, 0.9, 0.3]
      }}
      transition={{ 
        duration: 4.2, 
        repeat: Infinity, 
        ease: "easeInOut" 
      }}
      style={{
        position: "absolute",
        left: "5%",
        right: "5%",
        height: "2px",
        background:
          "linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 30%, hsl(var(--primary)) 70%, transparent 100%)",
        boxShadow: "0 0 15px 3px hsl(var(--primary) / 0.5), 0 0 4px 1px hsl(var(--primary))",
        zIndex: 5,
        pointerEvents: "none",
      }}
    />
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function PageLoader({
  variant = "full",
  label,
}: PageLoaderProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center py-6" role="status" aria-label="Loading">
        <BouncingPillsLoader size="sm" />
      </div>
    );
  }

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const routeMedia = getRouteMedia(pathname);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md overflow-hidden p-6"
    >
      {/* Content layout card */}
      <div className="relative z-10 flex flex-col items-center max-w-xs sm:max-w-sm w-full p-6 rounded-[22px] glass-card">
        {routeMedia ? (
          <div className="w-full h-32 sm:h-36 rounded-2xl overflow-hidden border border-border/70 mb-5 bg-muted/40">
            <img
              src={routeMedia.image}
              alt={routeMedia.alt}
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-center"
            />
          </div>
        ) : (
          /* Animated App Logo with subtle pulse */
          <motion.div
            animate={{
              scale: [1, 1.04, 1],
              opacity: [0.85, 1, 0.85],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="mb-6"
          >
            <img
              src={LOGO_BASE64}
              alt="Dawa Lens"
              style={{ width: 56, height: 56, objectFit: "contain" }}
            />
          </motion.div>
        )}

        {/* Pill loader */}
        <div className="mb-4">
          <BouncingPillsLoader size="md" />
        </div>

        {/* Dynamic scanning label */}
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xs font-medium text-muted-foreground text-center"
        >
          {label ?? routeMedia?.label ?? "Loading..."}
        </motion.p>
      </div>
    </motion.div>
  );
}
