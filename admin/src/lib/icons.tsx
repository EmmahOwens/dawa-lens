/**
 * admin/src/lib/icons.tsx
 *
 * Central icon export for the admin dashboard.
 * Wraps react-iconly icons with a lucide-react–compatible API:
 *   <Home size={20} className="text-primary" />
 *
 * Icons with no Iconly equivalent use hand-crafted SVGs
 * styled to match Iconly's rounded, modern aesthetic.
 */

import React from "react";
import {
  Activity as IActivity,
  AddUser as IAddUser,
  ArrowLeft as IArrowLeft,
  ArrowRight as IArrowRight,
  Calendar as ICalendar,
  Category as ICategory,
  Chart as IChart,
  Chat as IChat,
  ChevronLeft as IChevronLeft,
  ChevronRight as IChevronRight,
  CloseSquare as ICloseSquare,
  Danger as IDanger,
  Delete as IDelete,
  Document as IDocument,
  Download as IDownload,
  Filter as IFilter,
  Graph as IGraph,
  Heart as IHeart,
  Home as IHome,
  InfoCircle as IInfoCircle,
  Lock as ILock,
  Logout as ILogout,
  Message as IMessage,
  MoreCircle as IMoreCircle,
  Notification as INotification,
  Paper as IPaper,
  PaperDownload as IPaperDownload,
  Plus as IPlus,
  Scan as IScan,
  Search as ISearch,
  Send as ISend,
  Setting as ISetting,
  ShieldDone as IShieldDone,
  ShieldFail as IShieldFail,
  Show as IShow,
  Hide as IHide,
  Star as IStar,
  Swap as ISwap,
  TickSquare as ITickSquare,
  TimeCircle as ITimeCircle,
  TimeSquare as ITimeSquare,
  TwoUsers as ITwoUsers,
  Upload as IUpload,
  User as IUser,
  Work as IWork,
} from "react-iconly";

// ─── Types ─────────────────────────────────────────────────────────────────

export type IconProps = {
  size?: number;
  className?: string;
  /** Accepted for API compatibility with lucide patterns; ignored for Iconly icons */
  strokeWidth?: number;
  style?: React.CSSProperties;
  /** Override the Iconly set style */
  set?: "bold" | "broken" | "bulk" | "light" | "two-tone" | "curved";
};

export type IconType = React.FC<IconProps>;
export type LucideIcon = IconType;

// ─── Iconly wrapper factory ─────────────────────────────────────────────────

function iconly(
  IconComponent: React.ComponentType<any>,
  defaultSet: "bold" | "broken" | "bulk" | "light" | "two-tone" | "curved" = "bold"
): IconType {
  const WrappedIcon = ({
    size = 20,
    className = "",
    strokeWidth: _sw,
    style,
    set,
    ...rest
  }: IconProps) => (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, lineHeight: 1, ...style }}
      aria-hidden="true"
    >
      <IconComponent
        set={set ?? defaultSet}
        size={size}
        primaryColor="currentColor"
        style={{ display: "block", flexShrink: 0 }}
        {...rest}
      />
    </span>
  );
  WrappedIcon.displayName = `Iconly(${(IconComponent as any).displayName ?? "Icon"})`;
  return WrappedIcon;
}

// ─── Custom SVG factory ─────────────────────────────────────────────────────

function svg(paths: React.ReactNode, viewBox = "0 0 24 24"): IconType {
  const SvgIcon = ({
    size = 20,
    className = "",
    strokeWidth = 1.8,
    style,
  }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      style={style}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
  return SvgIcon;
}

// ─── Iconly icon exports ────────────────────────────────────────────────────

export const Home = iconly(IHome);
export const Bell = iconly(INotification);
export const BellIcon = iconly(INotification);
export const History = iconly(ITimeSquare);
export const Settings = iconly(ISetting);
export const Users = iconly(ITwoUsers);
export const User = iconly(IUser);
export const UserRound = iconly(IUser);
export const UserPlus = iconly(IAddUser);
export const Clock = iconly(ITimeCircle);
export const Calendar = iconly(ICalendar);
export const CalendarIcon = iconly(ICalendar);
export const Search = iconly(ISearch);
export const Heart = iconly(IHeart);
export const FileText = iconly(IDocument);
export const Download = iconly(IDownload);
export const PaperDownload = iconly(IPaperDownload);
export const Upload = iconly(IUpload);
export const Send = iconly(ISend);
export const Mail = iconly(IMessage);
export const MessageSquare = iconly(IChat);
export const Lock = iconly(ILock);
export const Eye = iconly(IShow);
export const EyeOff = iconly(IHide);
export const Key = iconly(ILock);
export const Shield = iconly(IShieldDone);
export const ShieldCheck = iconly(IShieldDone);
export const ShieldAlert = iconly(IShieldFail);
export const ArrowLeft = iconly(IArrowLeft);
export const ArrowRight = iconly(IArrowRight);
export const ChevronLeft = iconly(IChevronLeft);
export const ChevronRight = iconly(IChevronRight);
export const MoreHorizontal = iconly(IMoreCircle);
export const Plus = iconly(IPlus);
export const X = iconly(ICloseSquare);
export const Check = iconly(ITickSquare);
export const CheckCircle = iconly(ITickSquare);
export const LogOut = iconly(ILogout);
export const Trash2 = iconly(IDelete);
export const RefreshCw = iconly(ISwap);
export const Activity = iconly(IActivity);
export const TrendingUp = iconly(IGraph);
export const Info = iconly(IInfoCircle);
export const AlertCircle = iconly(IDanger);
export const AlertTriangle = iconly(IDanger);
export const Filter = iconly(IFilter);
export const LayoutDashboard = iconly(ICategory);
export const BarChart3 = iconly(IChart);
export const Server = iconly(IWork);
export const Scan = iconly(IScan);
export const Star = iconly(IStar);
export const Printer = iconly(IPaper);
export const UserX = iconly(ITwoUsers);
export const UserCheck = iconly(ITwoUsers);

// ─── Custom SVG icons ───────────────────────────────────────────────────────

export const Loader2 = ({
  size = 20,
  className = "",
  strokeWidth = 1.8,
  style,
}: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`shrink-0 animate-spin ${className}`}
    style={style}
    aria-hidden="true"
  >
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

export const Bot = svg(
  <>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </>
);

export const Pill = svg(
  <>
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </>
);

export const Sparkles = svg(
  <>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </>
);

export const Brain = svg(
  <>
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
    <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
    <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
    <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
    <path d="M6 18a4 4 0 0 1-1.967-.516" />
    <path d="M19.967 17.484A4 4 0 0 1 18 18" />
  </>
);

export const Sun = svg(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </>
);

export const Moon = svg(
  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
);

export const Monitor = svg(
  <>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </>
);

export const SkipForward = svg(
  <>
    <polygon points="5 4 15 12 5 20 5 4" />
    <line x1="19" x2="19" y1="5" y2="19" />
  </>
);

export const TrendingDown = svg(
  <>
    <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
    <polyline points="16 17 22 17 22 11" />
  </>
);

export const Database = svg(
  <>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </>
);

export const WifiOff = svg(
  <>
    <path d="M12 20h.01" />
    <path d="M8.5 16.429a5 5 0 0 1 7 0" />
    <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
    <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
    <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
    <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
    <path d="m2 2 20 20" />
  </>
);

export const ChevronDown = iconly(
  // use a custom SVG since react-iconly ChevronDown isn't in the imported list
  (() => {
    const C = ({
      size = 20,
      className = "",
      style,
    }: IconProps) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`shrink-0 ${className}`}
        style={style}
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    );
    return C as React.ComponentType<any>;
  })()
);

/** Alias kept for files that use `import { LucideIcon }` as a type */
export type { IconType as IconComponent };
