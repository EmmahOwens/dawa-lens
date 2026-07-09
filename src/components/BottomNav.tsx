import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Camera, Bell, History, Settings, Users } from "@/lib/icons";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { NativeService } from "@/services/nativeService";
import { ImpactStyle } from "@capacitor/haptics";
import { Keyboard } from "@capacitor/keyboard";
import { Capacitor } from "@capacitor/core";

// Custom hook to detect when the bottom navigation bar should be hidden (forms, input focus, keyboard, overlays)
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

  // 2. Input focus (Universal for web + native mobile browsers)
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

    // Initial check
    handleFocusChange();

    return () => {
      document.removeEventListener("focusin", handleFocusChange);
      document.removeEventListener("focusout", handleFocusChange);
    };
  }, []);

  // 3. Dialog / Sheet open (Universal via MutationObserver)
  useEffect(() => {
    const checkDialogs = () => {
      const dialogElement = document.querySelector(
        '[role="dialog"], [role="alertdialog"]'
      );
      const hasModal = !!dialogElement || document.body.style.pointerEvents === 'none';
      setIsDialogOpen(hasModal);
    };

    // Initial check
    checkDialogs();

    const observer = new MutationObserver(() => {
      checkDialogs();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-state"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // 4. Form routes (e.g. AddReminderPage /reminders/new)
  const isFormRoute =
    location.pathname.startsWith("/reminders/new") ||
    location.pathname.includes("/new") ||
    location.pathname.includes("/edit");

  return isKeyboardVisible || isInputFocused || isDialogOpen || isFormRoute;
}

export default function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const { reminders, doseLogs, isProfessionalMode } = useApp();
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
    { to: isProfessionalMode ? "/family" : "/history", icon: isProfessionalMode ? Users : History, label: isProfessionalMode ? "Family" : t("nav.history") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <AnimatePresence>
      {!shouldHide && (
        <motion.nav
          initial={{ y: 80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="fixed bottom-4 left-0 right-0 z-50 mx-auto max-w-[22rem] md:hidden px-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-between rounded-[2rem] bg-white/10 dark:bg-black/20 backdrop-blur-xl border border-white/10 dark:border-white/5 px-4 py-2.5 relative shadow-2xl">
            {/* Left Side Items */}
            <div className="flex flex-1 justify-around items-center">
              {navItems.slice(0, 2).map((item) => (
                <NavItem key={item.to} {...item} active={location.pathname === item.to} />
              ))}
            </div>

            {/* Central Scan Button */}
            <NavLink
              to="/scan"
              onClick={() => NativeService.haptics.impact(ImpactStyle.Medium)}
              className="relative flex h-14 w-14 items-center justify-center -mt-6"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="absolute h-full w-full rounded-full bg-primary shadow-[0_4px_14px_rgba(0,122,255,0.4)] flex items-center justify-center text-primary-foreground border-2 border-background gpu-accel"
              >
                <Camera size={24} strokeWidth={2.5} />
              </motion.div>
            </NavLink>

            {/* Right Side Items */}
            <div className="flex flex-1 justify-around items-center">
              {navItems.slice(2).map((item) => (
                <NavItem key={item.to} {...item} active={location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to))} />
              ))}
            </div>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

function NavItem({ to, icon: Icon, label, active, badge }: { to: string, icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>, label: string, active: boolean, badge?: boolean }) {
  return (
    <NavLink
      to={to}
      onClick={() => NativeService.haptics.impact(ImpactStyle.Light)}
      className="relative flex flex-col items-center justify-center w-12 h-12 group"
    >
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        className="relative flex flex-col items-center"
      >
        <Icon
          size={24}
          className={`relative z-10 transition-colors duration-300 ${active ? "text-primary dark:text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
          strokeWidth={active ? 2.5 : 2}
        />
        
        {badge && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background z-20"
          />
        )}

        {/* macOS Dock style dot indicator */}
        {active && (
          <motion.div
            layoutId="nav-indicator"
            className="absolute -bottom-3 w-1.5 h-1.5 rounded-full bg-primary dark:bg-foreground"
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 30,
            }}
          />
        )}
      </motion.div>
    </NavLink>
  );
}
