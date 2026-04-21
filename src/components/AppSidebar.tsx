import { Home, Camera, Clock, History, Settings, CopyPlus, Users, LogOut, Heart, ShieldCheck } from "lucide-react";
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
  const { isProfessionalMode, userProfile } = useApp();
  
  const items = [
    { title: t("nav.home"), url: "/", icon: Home },
    { title: t("nav.scan"), url: "/scan", icon: Camera },
    { title: t("nav.remind"), url: "/reminders/new", icon: Clock },
    { title: t("nav.history"), url: "/history", icon: History },
    ...(isProfessionalMode ? [{ title: "Family Hub", url: "/family", icon: Users, isPro: true }] : []),
    { title: t("nav.safety"), url: "/interactions", icon: CopyPlus },
    { title: t("nav.settings"), url: "/settings", icon: Settings },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-background/50 backdrop-blur-2xl transition-all duration-300">
      {/* Brand Header */}
      <div className="flex flex-col gap-6 px-4 py-8">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} transition-all duration-300`}>
          <div className="relative group">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-tr from-primary/40 to-primary/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col"
            >
              <span className="text-[17px] font-bold leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Dawa Lens
              </span>
              <span className="text-[11px] font-medium text-primary uppercase tracking-[0.1em] mt-1">
                Precision Health
              </span>
            </motion.div>
          )}
        </div>
      </div>

      <SidebarContent className="px-3">
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
                        className={`relative flex items-center gap-3 rounded-2xl py-3 px-4 transition-all duration-300 group ${
                          active 
                            ? 'text-primary-foreground font-semibold' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
                        }`}
                        activeClassName="" // We handle active styling via the container class above
                      >
                        {/* Animated background indicator */}
                        {active && (
                          <motion.div
                            layoutId="activeNav"
                            className="absolute inset-0 bg-primary rounded-2xl shadow-lg shadow-primary/20 z-0"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        
                        <div className={`relative z-10 flex items-center justify-center ${active ? 'text-primary-foreground' : 'text-primary group-hover:scale-110 transition-transform'}`}>
                          <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                        </div>
                        
                        {!collapsed && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="relative z-10 flex flex-1 items-center justify-between"
                          >
                            <span className="text-[14px] tracking-tight">{item.title}</span>
                            {item.isPro && (
                              <Badge variant="outline" className={`text-[9px] uppercase tracking-wider h-4 border-primary/30 ${active ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
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
        <div className={`flex flex-col gap-4 rounded-2xl bg-muted/30 p-4 border border-border/50 ${collapsed ? 'items-center px-2' : ''}`}>
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
              <AvatarImage src="" alt={userProfile?.name || "User"} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                {userProfile?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-bold truncate leading-tight">
                  {userProfile?.name || "Health User"}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">
                  {isProfessionalMode ? "CHW Professional" : "Personal Account"}
                </span>
              </div>
            )}
          </div>
          
          {!collapsed && (
            <div className="pt-2 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold text-[11px] uppercase tracking-wider">
                <ShieldCheck size={14} />
                <span>Verified</span>
              </div>
              <button className="text-muted-foreground hover:text-destructive transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
