/**
 * src/lib/icons.tsx
 *
 * Central icon export layer for the entire app.
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
  Bookmark as IBookmark,
  Buy as IBuy,
  Calendar as ICalendar,
  Camera as ICamera,
  Category as ICategory,
  Chart as IChart,
  Chat as IChat,
  ChevronDown as IChevronDown,
  ChevronLeft as IChevronLeft,
  ChevronRight as IChevronRight,
  ChevronUp as IChevronUp,
  CloseSquare as ICloseSquare,
  Danger as IDanger,
  Delete as IDelete,
  Discovery as IDiscovery,
  Document as IDocument,
  Download as IDownload,
  Filter as IFilter,
  Graph as IGraph,
  Heart as IHeart,
  Hide as IHide,
  Home as IHome,
  Image as IImage,
  InfoCircle as IInfoCircle,
  Location as ILocation,
  Lock as ILock,
  Logout as ILogout,
  Message as IMessage,
  MoreCircle as IMoreCircle,
  Notification as INotification,
  Paper as IPaper,
  PaperDownload as IPaperDownload,
  PaperPlus as IPaperPlus,
  PaperUpload as IPaperUpload,
  People as IPeople,
  Plus as IPlus,
  Scan as IScan,
  Search as ISearch,
  Send as ISend,
  Setting as ISetting,
  ShieldDone as IShieldDone,
  ShieldFail as IShieldFail,
  Show as IShow,
  Star as IStar,
  Swap as ISwap,
  TickSquare as ITickSquare,
  TimeCircle as ITimeCircle,
  TimeSquare as ITimeSquare,
  TwoUsers as ITwoUsers,
  Upload as IUpload,
  User as IUser,
  Video as IVideo,
  Wallet as IWallet,
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

/** Drop-in replacement for the LucideIcon type used in the app */
export type IconType = React.FC<IconProps>;
/** Alias kept for backwards compat */
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
// For icons not available in react-iconly, hand-crafted SVGs
// with rounded caps/joins to match Iconly's aesthetic.

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
export const Camera = iconly(ICamera);
export const SwitchCamera = iconly(ICamera); // repurposed; Iconly has no SwitchCamera
export const Bell = iconly(INotification);
export const BellIcon = iconly(INotification);
export const BellPlus = iconly(INotification);
export const History = iconly(ITimeSquare);
export const Settings = iconly(ISetting);
export const Users = iconly(ITwoUsers);
export const User = iconly(IUser);
export const UserRound = iconly(IUser);
export const UserSquare2 = iconly(IUser);
export const UserPlus = iconly(IAddUser);
export const Clock = iconly(ITimeCircle);
export const CalendarClock = iconly(ICalendar);
export const Calendar = iconly(ICalendar);
export const CalendarIcon = iconly(ICalendar);
export const Search = iconly(ISearch);
export const Heart = iconly(IHeart);
export const Heart2 = iconly(IHeart);
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
export const Shield = iconly(IShieldDone);
export const ShieldCheck = iconly(IShieldDone);
export const ShieldAlert = iconly(IShieldFail);
export const ShieldQuestion = iconly(IShieldFail);
export const Siren = iconly(IDanger);
export const ArrowLeft = iconly(IArrowLeft);
export const ArrowRight = iconly(IArrowRight);
export const ChevronLeft = iconly(IChevronLeft);
export const ChevronRight = iconly(IChevronRight);
export const ChevronDown = iconly(IChevronDown);
export const ChevronUp = iconly(IChevronUp);
export const MoreHorizontal = iconly(IMoreCircle);
export const Plus = iconly(IPlus);
export const PlusCircle = iconly(IPlus);
export const CopyPlus = iconly(IPaperPlus);
export const X = iconly(ICloseSquare);
export const XCircle = iconly(ICloseSquare);
export const Check = iconly(ITickSquare);
export const CheckCircle = iconly(ITickSquare);
export const CheckCircle2 = iconly(ITickSquare);
export const ClipboardCheck = iconly(ITickSquare);
export const Star = iconly(IStar);
export const Trophy = iconly(IStar); // closest Iconly match
export const Plane = iconly(IDiscovery);
export const ExternalLink = iconly(IDiscovery);
export const MapPin = iconly(ILocation);
export const LogOut = iconly(ILogout);
export const Save = iconly(IPaperUpload);
export const Share2 = iconly(IPaperUpload);
export const Printer = iconly(IPaper);
export const Trash2 = iconly(IDelete);
export const RefreshCw = iconly(ISwap);
export const Activity = iconly(IActivity);
export const TrendingUp = iconly(IGraph);
export const TrendingDown = iconly(IGraph);
export const Info = iconly(IInfoCircle);
export const AlertCircle = iconly(IDanger);
export const AlertTriangle = iconly(IDanger);
export const Package = iconly(IBuy);
export const Package2 = iconly(IBuy);
export const Flag = iconly(IBookmark);
export const PanelLeft = iconly(ICategory);
export const Zap = iconly(IScan);
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
export const ScanLine = iconly(IScan);

// ─── Custom SVG icons ───────────────────────────────────────────────────────
// Hand-crafted to match Iconly's rounded, modern aesthetic

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

export const Sparkles = svg(
  <>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </>
);

export const Rocket = svg(
  <>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
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

export const Cloud = svg(
  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
);

export const Sunrise = svg(
  <>
    <path d="M12 2v8" />
    <path d="m4.93 10.93 1.41 1.41" />
    <path d="M2 18h2" />
    <path d="M20 18h2" />
    <path d="m19.07 10.93-1.41 1.41" />
    <path d="M22 22H2" />
    <path d="m8 6 4-4 4 4" />
    <path d="M16 18a4 4 0 0 0-8 0" />
  </>
);

export const Pill = svg(
  <>
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </>
);

export const Syringe = svg(
  <>
    <path d="m18 2 4 4" />
    <path d="m17 7 3-3" />
    <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" />
    <path d="m9 11 4 4" />
    <path d="m5 19-3 3" />
    <path d="m14 4 6 6" />
  </>
);

export const Droplets = svg(
  <>
    <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
    <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
  </>
);

export const Tablets = svg(
  <>
    <circle cx="7" cy="7" r="5" />
    <circle cx="17" cy="17" r="5" />
    <path d="M12 17h10" />
    <path d="m3.46 10.54 7.08-7.08" />
  </>
);

export const Coffee = svg(
  <>
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
    <line x1="6" x2="6" y1="2" y2="4" />
    <line x1="10" x2="10" y1="2" y2="4" />
    <line x1="14" x2="14" y1="2" y2="4" />
  </>
);

export const Wine = svg(
  <>
    <path d="M8 22h8" />
    <path d="M7 10h10" />
    <path d="M12 15v7" />
    <path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
  </>
);

export const GlassWater = svg(
  <>
    <path d="M15.2 22H8.8a2 2 0 0 1-2-1.79L5 3h14l-1.81 17.21A2 2 0 0 1 15.2 22Z" />
    <path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0" />
  </>
);

export const Beef = svg(
  <>
    <circle cx="12.5" cy="8.5" r="2.5" />
    <path d="M12.5 2a6.5 6.5 0 0 0-6.22 4.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3A6.5 6.5 0 0 0 12.5 2Z" />
    <path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1 .31 2 6.49 6.49 0 0 1-2.6 5.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5" />
  </>
);

export const Salad = svg(
  <>
    <path d="M7 21h10" />
    <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" />
    <path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-3.19 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1" />
    <path d="m13 12 4-4" />
    <path d="M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2" />
  </>
);

export const Utensils = svg(
  <>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
  </>
);

export const Frown = svg(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
    <line x1="9" x2="9.01" y1="9" y2="9" />
    <line x1="15" x2="15.01" y1="9" y2="9" />
  </>
);

export const Meh = svg(
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="8" x2="16" y1="15" y2="15" />
    <line x1="9" x2="9.01" y1="9" y2="9" />
    <line x1="15" x2="15.01" y1="9" y2="9" />
  </>
);

export const Smile = svg(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 13s1.5 2 4 2 4-2 4-2" />
    <line x1="9" x2="9.01" y1="9" y2="9" />
    <line x1="15" x2="15.01" y1="9" y2="9" />
  </>
);

export const Monitor = svg(
  <>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </>
);

export const Terminal = svg(
  <>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" x2="20" y1="19" y2="19" />
  </>
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

export const Lightbulb = svg(
  <>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </>
);

export const ThumbsUp = svg(
  <>
    <path d="M7 10v12" />
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </>
);

export const ThumbsDown = svg(
  <>
    <path d="M17 14V2" />
    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
  </>
);

export const Dot = svg(
  <circle cx="12.1" cy="12.1" r="1" fill="currentColor" />
);

export const Circle = svg(
  <circle cx="12" cy="12" r="10" />
);

export const GripVertical = svg(
  <>
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="5" r="1" fill="currentColor" />
    <circle cx="9" cy="19" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="5" r="1" fill="currentColor" />
    <circle cx="15" cy="19" r="1" fill="currentColor" />
  </>
);

export const Minus = svg(
  <path d="M5 12h14" />
);

// WifiOff already exported above as custom SVG

// ─── Additional icons discovered from app imports ─────────────────────────────

/** Dashboard grid / layout icon */
export const LayoutDashboard = iconly(ICategory);

/** Camera scan / QR scan */
export const Scan = iconly(IScan);

/** Maximize / expand */
export const Maximize2 = svg(
  <>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" x2="14" y1="3" y2="10" />
    <line x1="3" x2="10" y1="21" y2="14" />
  </>
);

/** Alarm check / done */
export const AlarmCheck = svg(
  <>
    <circle cx="12" cy="13" r="8" />
    <path d="M5 3 2 6" />
    <path d="m22 6-3-3" />
    <path d="M6.38 18.7 4 21" />
    <path d="M17.64 18.67 20 21" />
    <path d="m9 13 2 2 4-4" />
  </>
);

/** Alarm clock off */
export const AlarmClockOff = svg(
  <>
    <path d="M6.87 6.87a8 8 0 1 0 11.26 11.26" />
    <path d="M19.9 14.25a8 8 0 0 0-9.15-9.15" />
    <path d="m22 6-3-3" />
    <path d="M6.26 18.67 4 21" />
    <path d="m2 2 20 20" />
    <path d="M4 4 2 6" />
  </>
);

/** Baby / child icon */
export const Baby = svg(
  <>
    <path d="M9 12h.01" />
    <path d="M15 12h.01" />
    <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
    <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
  </>
);

/** Database / storage */
export const Database = svg(
  <>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </>
);

/** Edit with pen (edit2) */
export const Edit2 = svg(
  <>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </>
);

/** Globe / world */
export const Globe = svg(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </>
);

/** More vertical (three dots vertical) */
export const MoreVertical = svg(
  <>
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="5" r="1" fill="currentColor" />
    <circle cx="12" cy="19" r="1" fill="currentColor" />
  </>
);

/** Navigation arrow */
export const Navigation = svg(
  <polygon points="3 11 22 2 13 21 11 13 3 11" />
);

/** Pencil */
export const Pencil = svg(
  <>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <path d="m15 5 4 4" />
  </>
);

/** Phone */
export const Phone = svg(
  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.42 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.4a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
);

/** Toggle left (off state) */
export const ToggleLeft = svg(
  <>
    <rect width="20" height="12" x="2" y="6" rx="6" ry="6" />
    <circle cx="8" cy="12" r="2" fill="currentColor" />
  </>
);

/** Toggle right (on state) */
export const ToggleRight = svg(
  <>
    <rect width="20" height="12" x="2" y="6" rx="6" ry="6" />
    <circle cx="16" cy="12" r="2" fill="currentColor" />
  </>
);

// ─── Re-exports / extras ─────────────────────────────────────────────────────

/** Alias kept for files that use `import { LucideIcon }` as a type */
export type { IconType as IconComponent };
