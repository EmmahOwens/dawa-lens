import { useState, useEffect } from "react";
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

  // 3. Dialog / Sheet open
  useEffect(() => {
    const checkDialogs = () => {
      const dialogElement = document.querySelector(
        '[role="dialog"], [role="alertdialog"]'
      );
      const hasModal = !!dialogElement || document.body.style.pointerEvents === "none";
      setIsDialogOpen(hasModal);
    };

    checkDialogs();

    let rafId: number | null = null;
    const observer = new MutationObserver(() => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        checkDialogs();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-state"],
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

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

  // Count reminders that haven't been logged today
  const pendingReminderCount = reminders.filter((r) => {
    if (!r.enabled) return false;
    return !doseLogs.some(
      (l) =>
        l.reminderId === r.id &&
        new Date(l.actionTime).toDateString() === new Date().toDateString()
    );
  }).length;

  const navItems = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/reminders", icon: Bell, label: t("nav.reminders", "Reminders"), badge: pendingReminderCount > 0 },
    { to: "/history", icon: History, label: t("nav.history") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <AnimatePresence>
      {!shouldHide && (
        <motion.nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="fixed bottom-3 left-0 right-0 z-50 mx-auto max-w-[21rem] md:hidden px-3"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) * 0.4 + 0.6rem)" }}
        >
          <div className="flex items-center justify-between rounded-full bg-[#f5f5f7]/80 dark:bg-[#1d1d1f]/80 blur-frost border border-black/[0.08] dark:border-white/[0.12] px-3 py-1.5 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.7),0_8px_24px_-6px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.12),0_8px_24px_-6px_rgba(0,0,0,0.35)]">
            {/* Left Side Items */}
            <div className="flex flex-1 justify-around items-center">
              {navItems.slice(0, 2).map((item) => (
                <NavItem key={item.to} {...item} active={location.pathname === item.to} />
              ))}
            </div>

            {/* Central Apple Action Blue Scan Button */}
            <NavLink
              to="/scan"
              aria-label={t("nav.scan")}
              onClick={() => NativeService.haptics.impact(ImpactStyle.Medium)}
              className="relative flex h-11 w-11 items-center justify-center shrink-0 mx-1 active:scale-95 transition-transform"
            >
              <div className="h-full w-full rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.35)] ring-1 ring-black/5 dark:ring-white/10">
                <Camera size={20} />
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
  badge,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  badge?: boolean;
}) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      onClick={() => NativeService.haptics.impact(ImpactStyle.Light)}
      className="relative flex flex-col items-center justify-center w-11 h-11 rounded-full active:scale-95 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all"
    >
      <div className="relative flex flex-col items-center">
        <Icon
          size={20}
          className={`transition-colors duration-200 ${
            active ? "text-primary font-semibold" : "text-muted-foreground/85 hover:text-foreground"
          }`}
        />

        {badge && (
          <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-[#f5f5f7] dark:ring-[#1d1d1f]" />
        )}

        {/* Apple subtle active dot */}
        {active && (
          <motion.div
            layoutId="apple-nav-dot"
            className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-primary"
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
          />
        )}
      </div>
    </NavLink>
  );
}
