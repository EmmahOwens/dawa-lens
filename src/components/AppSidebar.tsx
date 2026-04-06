import { Home, Camera, Clock, History, Settings, CopyPlus } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const items = [
    { title: t("nav.home"), url: "/", icon: Home },
    { title: t("nav.scan"), url: "/scan", icon: Camera },
    { title: t("nav.remind"), url: "/reminders/new", icon: Clock },
    { title: t("nav.history"), url: "/history", icon: History },
    { title: t("nav.safety"), url: "/interactions", icon: CopyPlus },
    { title: t("nav.settings"), url: "/settings", icon: Settings },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
                <span className="text-lg font-black bg-gradient-to-br from-primary to-primary/50 bg-clip-text text-transparent uppercase tracking-tighter">
                  Dawa Lens
                </span>
              </div>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-primary/5 transition-all duration-300 rounded-full py-6 px-4 group"
                      activeClassName="bg-primary text-primary-foreground font-bold shadow-[0_8px_20px_rgba(var(--primary-rgb),0.3)] scale-[1.02]"
                    >
                      <item.icon className={`mr-3 h-5 w-5 transition-transform group-hover:scale-110 ${isActive(item.url) ? 'scale-110' : ''}`} />
                      {!collapsed && <span className="tracking-tight">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
