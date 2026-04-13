import { Home, Camera, Clock, History, Settings, CopyPlus, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
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

  const { isProfessionalMode } = useApp();
  
  const items = [
    { title: t("nav.home"), url: "/", icon: Home },
    { title: t("nav.scan"), url: "/scan", icon: Camera },
    { title: t("nav.remind"), url: "/reminders/new", icon: Clock },
    { title: t("nav.history"), url: "/history", icon: History },
    ...(isProfessionalMode ? [{ title: "Family Hub", url: "/family", icon: Users }] : []),
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
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
                <span className="text-[15px] font-semibold tracking-tight text-foreground">
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
                      className="hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-200 rounded-lg py-2 px-3 group text-[14px]"
                      activeClassName="bg-primary text-primary-foreground font-medium dark:bg-primary shadow-sm"
                    >
                      <item.icon className={`mr-3 h-[18px] w-[18px] ${isActive(item.url) ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`} />
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
