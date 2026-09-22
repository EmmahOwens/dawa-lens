import { Home, Camera, Clock, History, Settings, CopyPlus, Users, LogOut, Heart, ShieldCheck, Package, Pill } from "@/lib/icons";
import { NavLink } from "@/components/NavLink";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AppSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isProfessionalMode, userProfile, logoutUser } = useApp();
  
  const items = [
    { title: t("nav.home"), url: "/", icon: Home },
    { title: t("nav.scan"), url: "/scan", icon: Camera },
    { title: t("nav.remind"), url: "/reminders/new", icon: Clock },
    { title: t("nav.history"), url: "/history", icon: History },
    { title: t("nav.medications", "Medications"), url: "/medications", icon: Pill },
    { title: t("nav.medvault", "Med Vault"), url: "/medvault", icon: Package },
    { title: "Family Hub", url: "/family", icon: Users },
    { title: t("nav.safety"), url: "/interactions", icon: CopyPlus },
    { title: t("nav.settings"), url: "/settings", icon: Settings },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5 bg-background/60 backdrop-blur-3xl backdrop-saturate-[2] transition-all duration-300">
      {/* Brand Header */}
      <div className="flex flex-col gap-6 px-4 py-8 border-b border-white/5">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} transition-all duration-300`}>
          <div className="relative group">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-tr from-primary/50 to-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-b from-primary/20 to-primary/5 border border-primary/30 text-primary shadow-inner">
              <img src={LOGO_BASE64} alt="Logo" className="w-6 h-6 object-contain drop-shadow-sm" />
            </div>
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col"
            >
              <span className="text-[17px] font-black leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Dawa Lens
              </span>
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.15em] mt-1.5 opacity-80">
                Precision Health
              </span>
            </motion.div>
          )}
        </div>
      </div>

      <SidebarContent className="px-3 pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} className="h-auto p-0 hover:bg-transparent">
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`relative flex items-center gap-3 rounded-[1.25rem] py-3 px-4 transition-all duration-300 group ${
                          active 
                            ? 'text-primary-foreground font-bold shadow-md' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
                        }`}
                        activeClassName="" // We handle active styling via the container class above
                      >
                        {/* Animated background indicator */}
                        {active && (
                          <motion.div
                            layoutId="activeNav"
                            className="absolute inset-0 bg-gradient-to-r from-primary to-primary/90 rounded-[1.25rem] shadow-lg shadow-primary/25 z-0 border border-primary/20"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        
                        <div className={`relative z-10 flex items-center justify-center ${active ? 'text-primary-foreground' : 'text-primary/70 group-hover:text-primary group-hover:scale-110 transition-transform'}`}>
                          <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                        </div>
                        
                        {!collapsed && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="relative z-10 flex flex-1 items-center justify-between"
                          >
                            <span className="text-[13px] tracking-wide">{item.title}</span>
                          </motion.div>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 mt-auto">
        <motion.div
          whileHover={!collapsed ? { scale: 1.01 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`relative flex items-center gap-2.5 rounded-2xl p-2.5 border border-border/30 bg-gradient-to-br from-card/80 to-background/60 shadow-sm backdrop-blur-sm overflow-hidden transition-all duration-300 ${
            collapsed ? 'justify-center px-1.5' : 'hover:border-primary/25 hover:shadow-primary/5 hover:shadow-md'
          }`}
        >
          {/* Subtle ambient glow */}
          {!collapsed && (
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          )}

          <div className="relative shrink-0">
            <Avatar className="h-8 w-8 border-[1.5px] border-primary/20 shadow-sm ring-2 ring-background">
              <AvatarImage src="" alt={userProfile?.name || "User"} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-black text-[11px]">
                {userProfile?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            {/* Online indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border-[1.5px] border-background shadow-sm" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[11.5px] font-black truncate leading-tight text-foreground/90">
                  {userProfile?.name || "Health User"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldCheck size={9} className="text-success shrink-0" />
                  <span className="text-[9px] text-success font-bold uppercase tracking-wider truncate">
                    {isProfessionalMode ? "Professional" : "Verified"}
                  </span>
                </div>
              </div>
              <button
                onClick={logoutUser}
                aria-label="Log out"
                className="shrink-0 p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all active:scale-90"
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
        </motion.div>
      </SidebarFooter>
    </Sidebar>
  );
}
