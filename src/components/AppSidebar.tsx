import { Home, Camera, Clock, History, Settings, CopyPlus, Users, LogOut, ShieldCheck, Package, Pill } from "@/lib/icons";
import { NavLink } from "@/components/NavLink";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { motion } from "framer-motion";
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
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-[#f5f5f7] dark:bg-[#161617] transition-all duration-200"
    >
      {/* Brand Header */}
      <div className="flex flex-col px-4 py-5 border-b border-border">
        <div
          className={`flex items-center ${
            collapsed ? "justify-center" : "gap-3"
          } transition-all duration-200`}
        >
          <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-white dark:bg-[#252527] border border-border shrink-0 shadow-sm">
            <img src={LOGO_BASE64} alt="Logo" className="w-5 h-5 object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[15px] font-semibold tracking-tight text-foreground leading-tight">
                Dawa Lens
              </span>
              <span className="text-[11px] font-normal text-muted-foreground tracking-normal">
                Precision Health
              </span>
            </div>
          )}
        </div>
      </div>

      <SidebarContent className="px-3 pt-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} className="h-auto p-0 hover:bg-transparent">
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`relative flex items-center gap-3 rounded-full py-2.5 px-3.5 transition-all duration-150 active:scale-95 ${
                          active
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                        activeClassName=""
                      >
                        <item.icon size={18} />

                        {!collapsed && (
                          <span className="text-[14px] leading-none tracking-normal truncate">
                            {item.title}
                          </span>
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

      <SidebarFooter className="p-3 mt-auto border-t border-border">
        <div
          className={`flex items-center gap-2.5 rounded-2xl p-2 bg-white dark:bg-[#252527] border border-border ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="relative shrink-0">
            <Avatar className="h-7 w-7 border border-border">
              <AvatarImage src="" alt={userProfile?.name || "User"} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-[11px]">
                {userProfile?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
              <div className="min-w-0">
                <p className="text-[12px] font-medium truncate text-foreground">
                  {userProfile?.name || "Health User"}
                </p>
                <div className="flex items-center gap-1">
                  <ShieldCheck size={10} className="text-primary shrink-0" />
                  <span className="text-[10px] text-muted-foreground truncate">
                    {isProfessionalMode ? "Professional" : "Verified"}
                  </span>
                </div>
              </div>
              <button
                onClick={logoutUser}
                aria-label="Log out"
                className="shrink-0 p-1 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
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
