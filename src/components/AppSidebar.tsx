import { Home, Camera, Clock, History, Settings, CopyPlus, Users, LogOut, Heart, ShieldCheck, Package } from "@/lib/icons";
import { NavLink } from "@/components/NavLink";
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
import { Badge } from "@/components/ui/badge";

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
    { title: t("nav.medvault", "Med Vault"), url: "/medvault", icon: Package },
    ...(isProfessionalMode ? [{ title: "Family Hub", url: "/family", icon: Users, isPro: true }] : []),
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
              <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain drop-shadow-sm" />
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
                            {item.isPro && (
                              <Badge variant="outline" className={`text-[8px] uppercase tracking-widest h-4 border-primary/30 px-1.5 ${active ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                Pro
                              </Badge>
                            )}
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

      <SidebarFooter className="p-4 mt-auto">
        <div className={`flex flex-col gap-4 rounded-[1.5rem] bg-card/50 p-4 border border-border/40 shadow-sm ${collapsed ? 'items-center px-2' : 'hover:border-primary/20 transition-colors duration-300'}`}>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-background shadow-md">
              <AvatarImage src="" alt={userProfile?.name || "User"} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-black text-xs">
                {userProfile?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-black truncate leading-tight text-foreground/90">
                  {userProfile?.name || "Health User"}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate mt-0.5">
                  {isProfessionalMode ? "CHW Professional" : "Personal"}
                </span>
              </div>
            )}
          </div>
          
          {!collapsed && (
            <div className="pt-3 mt-1 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-success font-black text-[9px] uppercase tracking-widest bg-success/10 px-2 py-1 rounded-full border border-success/20">
                <ShieldCheck size={12} />
                <span>Verified</span>
              </div>
              <button 
                onClick={logoutUser}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all active:scale-95"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
