import { useState, useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Camera, Bell, History, Settings } from "@/lib/icons";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { NativeService } from "@/services/nativeService";
import { ImpactStyle } from "@capacitor/haptics";
import { Keyboard } from "@capacitor/keyboard";
import { Capacitor } from "@capacitor/core";

// Custom hook to detect when the bottom navigation bar should be hidden
function useSmartHideBottomNav() {
  const location = useLocation();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 1. Keyboard visibility (Capacitor native)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const showPromise = Keyboard.addListener("keyboardWillShow", () => {
      setIsKeyboardVisible(true);
    });
    const hidePromise = Keyboard.addListener("keyboardWillHide", () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showPromise.then((h) => h.remove()).catch(() => {});
      hidePromise.then((h) => h.remove()).catch(() => {});
    };
  }, []);

  // 2. Input focus (Universal)
  useEffect(() => {
    const handleFocusChange = () => {
      const activeEl = document.activeElement;
      if (!activeEl) {
        setIsInputFocused(false);
        return;
      }

      const tagName = activeEl.tagName;
      const isInput =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        activeEl.getAttribute("contenteditable") === "true";

      setIsInputFocused(!!isInput);
    };

    document.addEventListener("focusin", handleFocusChange);
    document.addEventListener("focusout", handleFocusChange);
    handleFocusChange();

    return () => {
      document.removeEventListener("focusin", handleFocusChange);
      document.removeEventListener("focusout", handleFocusChange);
    };
  }, []);

  // 3. Dialog / Sheet open — lightweight top-level portal observer only (NO subtree: true!)
  // Radix portals and custom modals mount directly under document.body (or lock body style),
  // so observing direct body children eliminates per-frame DOM mutation storms during animations.
  useEffect(() => {
    const checkDialogs = () => {
      const hasModal =
        document.body.style.pointerEvents === "none" ||
        document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
      setIsDialogOpen((prev) => (prev === hasModal ? prev : hasModal));
    };

    checkDialogs();

    let rafId: number | null = null;
    const scheduleCheck = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        checkDialogs();
      });
    };

    const observer = new MutationObserver(scheduleCheck);
    observer.observe(document.body, {
      childList: true,
      subtree: false,
      attributes: true,
      attributeFilter: ["style", "data-scroll-locked"],
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [location.pathname]);

  // 4. Form routes
  const isFormRoute =
    location.pathname.startsWith("/reminders/new") ||
    location.pathname.includes("/new") ||
    location.pathname.includes("/edit");

  return isKeyboardVisible || isInputFocused || isDialogOpen || isFormRoute;
}

export default function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const { reminders, doseLogs } = useApp();
  const shouldHide = useSmartHideBottomNav();

  // Memoized count of reminders not yet logged today (avoids repeated Date allocations per render)
  const pendingReminderCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    const loggedTodayIds = new Set<string>();
    for (const l of doseLogs) {
      if (new Date(l.actionTime).toDateString() === todayStr) {
        loggedTodayIds.add(l.reminderId);
      }
    }
    let count = 0;
    for (const r of reminders) {
      if (r.enabled && !loggedTodayIds.has(r.id)) count++;
    }
    return count;
  }, [reminders, doseLogs]);

  const navItems = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/reminders", icon: Bell, label: t("nav.reminders", "Reminders"), badgeCount: pendingReminderCount },
    { to: "/history", icon: History, label: t("nav.history") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <AnimatePresence>
      {!shouldHide && (
        <motion.nav
          initial={{ y: 72, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 72, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          aria-label={t("nav.primary", "Primary navigation")}
          className="fixed bottom-3 left-0 right-0 z-50 mx-auto max-w-[21rem] md:hidden px-3"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) * 0.4 + 0.6rem)" }}
        >
          <div className="pointer-events-auto relative flex items-center justify-between rounded-full frosted-bottom-dock px-3 py-1.5">
            {/* Left Side Items */}
            <div className="flex flex-1 justify-around items-center">
              {navItems.slice(0, 2).map((item) => (
                <NavItem key={item.to} {...item} active={location.pathname === item.to} />
              ))}
            </div>

            {/* Central Floating / Protruding Scan Button */}
            <NavLink
              to="/scan"
              aria-label={t("nav.scan")}
              onPointerDown={() => {
                void NativeService.haptics.impact(ImpactStyle.Medium);
              }}
              className="relative -mt-6 flex h-14 w-14 items-center justify-center shrink-0 mx-1.5 rounded-full active:scale-95 hover:scale-[1.03] transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div
                className={`h-full w-full rounded-full bg-primary/95 flex items-center justify-center text-primary-foreground ring-4 ring-white/65 dark:ring-zinc-900/70 shadow-[0_10px_24px_-4px_hsl(var(--primary)/0.55),inset_0_1px_1px_0_rgba(255,255,255,0.45)] transition-[filter,transform] duration-150 ${
                  location.pathname === "/scan" ? "brightness-110" : ""
                }`}
              >
                <Camera size={24} aria-hidden="true" />
              </div>
            </NavLink>

            {/* Right Side Items */}
            <div className="flex flex-1 justify-around items-center">
              {navItems.slice(2).map((item) => (
                <NavItem
                  key={item.to}
                  {...item}
                  active={
                    location.pathname === item.to ||
                    (item.to !== "/" && location.pathname.startsWith(item.to))
                  }
                />
              ))}
            </div>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
  badgeCount = 0,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  label: string;
  active: boolean;
  badgeCount?: number;
}) {
  return (
    <NavLink
      to={to}
      aria-label={badgeCount > 0 ? `${label} (${badgeCount} pending)` : label}
      onPointerDown={() => {
        if (!active) {
          void NativeService.haptics.selection();
        }
      }}
      className={`relative flex flex-col items-center justify-center w-11 h-11 rounded-full active:scale-[0.92] transition-[transform,background-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "bg-white/65 dark:bg-white/15 shadow-xs"
          : "hover:bg-white/35 dark:hover:bg-white/10"
      }`}
    >
      <div className="relative flex flex-col items-center">
        <Icon
          size={20}
          aria-hidden={true}
          className={`transition-colors duration-150 ${
            active
              ? "text-primary font-semibold"
              : "text-foreground/75 dark:text-white/80 hover:text-foreground dark:hover:text-white"
          }`}
        />

        {badgeCount > 0 && (
          <div
            aria-hidden="true"
            className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-white/60 dark:ring-black/60"
          />
        )}

        {/* GPU-composited active indicator dot (off main thread during route transitions) */}
        <span
          aria-hidden="true"
          className={`absolute -bottom-1.5 w-1 h-1 rounded-full bg-primary transition-[transform,opacity] duration-200 ease-out ${
            active ? "opacity-100 scale-100" : "opacity-0 scale-50"
          }`}
        />
      </div>
    </NavLink>
  );
}
