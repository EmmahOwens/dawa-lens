import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import {
  Home,
  Bell,
  History,
  Zap,
  Users,
  Plane,
  Heart,
  FileText,
  Settings,
  ScanLine,
  PlusCircle,
  LucideIcon,
  Package,
  Pill,
  Search,
} from "@/lib/icons";

/** Valid internal application routes that can be navigated to. */
export const VALID_APP_ROUTES = new Set([
  "/",
  "/reminders",
  "/reminders/new",
  "/medications",
  "/history",
  "/interactions",
  "/family",
  "/travel",
  "/wellness",
  "/report",
  "/settings",
  "/scan",
  "/search",
  "/results",
  "/medvault",
]);

/** Maps DawaGPT custom/alias routes to actual application page routes. */
export const GPT_ROUTE_MAP: Record<string, string> = {
  // Home / Dashboard
  "/": "/",
  "/dashboard": "/",
  "/home": "/",
  "/main": "/",
  "/index": "/",

  // Medications / Cabinet / Prescriptions / Add Medicine
  "/medications": "/medications",
  "/medication": "/medications",
  "/meds": "/medications",
  "/medicine": "/medications",
  "/medicines": "/medications",
  "/medicine-list": "/medications",
  "/medication-list": "/medications",
  "/cabinet": "/medications",
  "/my-medications": "/medications",
  "/my-meds": "/medications",
  "/prescriptions": "/medications",
  "/add-medication": "/medications",
  "/add-medicine": "/medications",
  "/add-meds": "/medications",
  "/new-medication": "/medications",
  "/new-medicine": "/medications",
  "/add-prescriptions": "/medications",

  // Reminders - List
  "/reminders": "/reminders",
  "/reminder": "/reminders",
  "/alarms": "/reminders",
  "/alarm": "/reminders",
  "/schedule": "/reminders",
  "/schedules": "/reminders",
  "/my-reminders": "/reminders",
  "/dose-reminders": "/reminders",

  // Reminders - Add / New / Create
  "/reminders/new": "/reminders/new",
  "/reminder/new": "/reminders/new",
  "/new-reminder": "/reminders/new",
  "/add-reminder": "/reminders/new",
  "/create-reminder": "/reminders/new",
  "/set-reminder": "/reminders/new",
  "/remind": "/reminders/new",
  "/new-alarm": "/reminders/new",
  "/add-alarm": "/reminders/new",
  "/create-alarm": "/reminders/new",
  "/schedule-reminder": "/reminders/new",
  "/schedule-dose": "/reminders/new",
  "/reminders/add": "/reminders/new",
  "/reminders/create": "/reminders/new",

  // Med Vault / Stock / Inventory
  "/medvault": "/medvault",
  "/med-vault": "/medvault",
  "/vault": "/medvault",
  "/stock": "/medvault",
  "/inventory": "/medvault",
  "/pill-tracker": "/medvault",
  "/pills": "/medvault",
  "/refill": "/medvault",
  "/refills": "/medvault",
  "/restock": "/medvault",
  "/supplies": "/medvault",

  // Interactions & Safety
  "/interactions": "/interactions",
  "/interaction": "/interactions",
  "/safety": "/interactions",
  "/drug-interactions": "/interactions",
  "/food-interactions": "/interactions",
  "/safety-guard": "/interactions",
  "/side-effects": "/interactions",
  "/conflicts": "/interactions",

  // Family Hub / Dependents / Profiles
  "/family": "/family",
  "/family-hub": "/family",
  "/clients": "/family",
  "/client": "/family",
  "/patients": "/family",
  "/patient": "/family",
  "/dependents": "/family",
  "/dependent": "/family",
  "/profiles": "/family",
  "/child": "/family",
  "/children": "/family",
  "/add-family": "/family",
  "/add-dependent": "/family",
  "/add-patient": "/family",

  // Dose History & Logs
  "/history": "/history",
  "/logs": "/history",
  "/dose-history": "/history",
  "/dose-logs": "/history",
  "/past-doses": "/history",
  "/adherence": "/history",
  "/streak": "/history",

  // Wellness Hub
  "/wellness": "/wellness",
  "/wellness-hub": "/wellness",
  "/symptoms": "/wellness",
  "/symptom": "/wellness",
  "/mood": "/wellness",
  "/vibe": "/wellness",
  "/vitality": "/wellness",
  "/meal-journal": "/wellness",

  // Travel Companion
  "/travel": "/travel",
  "/travel-companion": "/travel",
  "/trip": "/travel",
  "/flight": "/travel",
  "/timezone": "/travel",

  // Doctor-Ready Reports
  "/report": "/report",
  "/reports": "/report",
  "/care-report": "/report",
  "/doctor-report": "/report",
  "/doctor-reports": "/report",
  "/export-report": "/report",
  "/export": "/report",
  "/pdf": "/report",

  // Visual Scanner
  "/scan": "/scan",
  "/scan-medicine": "/scan",
  "/scanner": "/scan",
  "/scan-pill": "/scan",
  "/camera": "/scan",
  "/ocr": "/scan",

  // Search & Monographs
  "/search": "/search",
  "/medication-info": "/search",
  "/lookup": "/search",
  "/drug-info": "/search",
  "/results": "/results",

  // Settings
  "/settings": "/settings",
  "/profile": "/settings",
  "/preferences": "/settings",
  "/account": "/settings",
};

/**
 * Resolves any href or link text to a valid internal application route.
 * Handles full URLs (e.g. https://dawalens.app/medications), URLs without leading slashes,
 * custom alias slugs, and semantic keyword matching on both href and link label.
 * Returns null if the link cannot be safely mapped to an application page.
 */
export function resolveToInternalRoute(rawHref: string, label: string = ""): string | null {
  if (!rawHref && !label) return null;

  let cleaned = (rawHref || "").trim();

  // Strip mailto:, tel:, or javascript:
  if (/^(?:javascript|mailto|tel):/i.test(cleaned)) {
    return null;
  }

  // Parse if it's an absolute URL
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const parsed = new URL(cleaned);
      cleaned = parsed.pathname;
    } catch {
      cleaned = cleaned.replace(/^https?:\/\/[^/]+/i, "");
    }
  }

  // Strip hash and query strings
  cleaned = cleaned.split("?")[0].split("#")[0].trim();

  // Strip any trailing slashes except for root
  if (cleaned.length > 1 && cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }

  // Ensure leading slash for route matching
  if (cleaned && !cleaned.startsWith("/")) {
    cleaned = `/${cleaned}`;
  }

  const normalizedLower = cleaned.toLowerCase();

  // 1. Direct dictionary match
  if (GPT_ROUTE_MAP[normalizedLower]) {
    return GPT_ROUTE_MAP[normalizedLower];
  }

  // 2. Direct match against valid routes
  if (VALID_APP_ROUTES.has(normalizedLower)) {
    return normalizedLower;
  }

  // 3. Semantic keyword resolution across href and label text
  const semantic = `${cleaned} ${label}`.toLowerCase();

  // Reminders - new / create / add
  if (
    (semantic.includes("reminder") || semantic.includes("alarm") || semantic.includes("schedule")) &&
    (semantic.includes("new") || semantic.includes("create") || semantic.includes("set") || semantic.includes("add") || semantic.includes("first"))
  ) {
    return "/reminders/new";
  }

  // Reminders - general
  if (semantic.includes("reminder") || semantic.includes("alarm") || semantic.includes("schedule")) {
    return "/reminders";
  }

  // Vault / stock / inventory / refill
  if (
    semantic.includes("vault") ||
    semantic.includes("stock") ||
    semantic.includes("inventory") ||
    semantic.includes("refill") ||
    semantic.includes("supplies")
  ) {
    return "/medvault";
  }

  // Medications / cabinet / prescriptions / pills
  if (
    semantic.includes("medication") ||
    semantic.includes("medicine") ||
    semantic.includes("meds") ||
    semantic.includes("cabinet") ||
    semantic.includes("prescription") ||
    semantic.includes("pill") ||
    semantic.includes("drug")
  ) {
    if (semantic.includes("search") || semantic.includes("lookup") || semantic.includes("fact") || semantic.includes("monograph")) {
      return "/search";
    }
    return "/medications";
  }

  // Interactions & safety
  if (semantic.includes("interaction") || semantic.includes("safety") || semantic.includes("conflict") || semantic.includes("side effect")) {
    return "/interactions";
  }

  // Family Hub / dependents / children
  if (
    semantic.includes("family") ||
    semantic.includes("dependent") ||
    semantic.includes("child") ||
    semantic.includes("patient") ||
    semantic.includes("client")
  ) {
    return "/family";
  }

  // Dose History & logs
  if (semantic.includes("history") || semantic.includes("log") || semantic.includes("streak") || semantic.includes("adherence")) {
    return "/history";
  }

  // Wellness Hub / symptoms
  if (
    semantic.includes("wellness") ||
    semantic.includes("symptom") ||
    semantic.includes("mood") ||
    semantic.includes("vibe") ||
    semantic.includes("vitality")
  ) {
    return "/wellness";
  }

  // Travel
  if (semantic.includes("travel") || semantic.includes("trip") || semantic.includes("flight") || semantic.includes("timezone")) {
    return "/travel";
  }

  // Doctor Report
  if (semantic.includes("report") || semantic.includes("doctor") || semantic.includes("pdf") || semantic.includes("export")) {
    return "/report";
  }

  // Scanner
  if (semantic.includes("scan") || semantic.includes("camera") || semantic.includes("ocr")) {
    return "/scan";
  }

  // Search
  if (semantic.includes("search") || semantic.includes("lookup")) {
    return "/search";
  }

  // Settings
  if (semantic.includes("setting") || semantic.includes("preference") || semantic.includes("profile") || semantic.includes("account")) {
    return "/settings";
  }

  // Home / Dashboard
  if (semantic.includes("home") || semantic.includes("dashboard")) {
    return "/";
  }

  return null;
}

/** Maps known internal routes to an icon for the link chip. */
const ROUTE_ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/reminders": Bell,
  "/reminders/new": PlusCircle,
  "/medications": Pill,
  "/history": History,
  "/interactions": Zap,
  "/family": Users,
  "/travel": Plane,
  "/wellness": Heart,
  "/report": FileText,
  "/settings": Settings,
  "/scan": ScanLine,
  "/search": Search,
  "/results": Search,
  "/medvault": Package,
};

interface InternalLinkChipProps {
  to: string;
  label: string;
  onClick?: () => void;
}

function InternalLinkChip({ to, label, onClick }: InternalLinkChipProps) {
  const Icon = ROUTE_ICONS[to] ?? Home;
  return (
    <Link
      to={to}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 rounded-md bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-[13px] font-semibold align-baseline active:scale-95 transition-all mx-0.5 no-underline shadow-xs hover:border-primary/40 cursor-pointer"
    >
      <Icon size={11} className="shrink-0 text-primary" />
      <span>{label}</span>
    </Link>
  );
}

/**
 * Parses text containing [Label](/route) or [Label](https://...) syntax
 * and renders internal routes as styled React Router chips,
 * and external URLs as anchor chips.
 *
 * Uses react-markdown for rich text formatting.
 */
interface MessageRendererProps {
  text: string;
  /** Called when an internal link chip is clicked (e.g. to close the chat panel). */
  onNavigate?: () => void;
  className?: string;
}

/**
 * Normalizes raw or AI-generated markdown strings so that:
 * 1. Escaped newlines ('\n', '\\n', '\r\n') from JSON/AI responses are converted to real line breaks.
 * 2. Escaped quotes (\" or \') are converted to standard quotes.
 * 3. Unicode bullets (•) and list items are normalized to markdown bullets.
 * 4. List blocks that immediately follow non-empty paragraph text (e.g. "Timezone Shift\n- Nairobi...")
 *    receive a preceding blank line so that markdown parsers treat them as true lists instead of inline text.
 * 5. Internal metadata delimiters and action tags are cleanly stripped.
 */
export function normalizeMarkdown(text: string): string {
  if (typeof text !== "string") return "";

  // 1. Strip metadata blocks and internal action tags
  let clean = text
    .replace(/(?:###\s*METADATA\s*###|---\s*METADATA\s*---|###\s*Metadata\s*###|###METADATA###|---METADATA---)[\s\S]*$/i, "")
    .replace(/\n\s*\{\s*"(?:suggestions|source|action)"[\s\S]*\}\s*$/i, "")
    .replace(/\[ACTION EXECUTED:.*?\]/g, "")
    .replace(/\[(?:Previous\s+)?suggestions(?:\s+offered)?:\s*.*?\]/gis, "")
    .replace(/(?:\r?\n\s*[-*_]{3,}\s*)+$/g, "");

  // 2. Unescape literal escape sequences commonly emitted by LLMs in JSON string values
  clean = clean
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");

  // 3. Convert unicode bullets into standard markdown list syntax
  clean = clean.replace(/(?:^|\n)\s*•\s*/g, "\n- ");

  // 4. Ensure lists following a paragraph start on a new markdown block with a blank line separator
  const rawLines = clean.split("\n");
  const formattedLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const prevLine = i > 0 ? rawLines[i - 1] : "";
    const isListItem = /^\s*([*•-]\s+|\d+[\.\)]\s+)/.test(line);
    const prevIsListItem = /^\s*([*•-]\s+|\d+[\.\)]\s+)/.test(prevLine);

    if (isListItem && !prevIsListItem && prevLine.trim().length > 0) {
      formattedLines.push(""); // Add blank line before list start
    }
    formattedLines.push(line);
  }

  clean = formattedLines.join("\n");

  return clean.trim();
}

export default function MessageRenderer({ text, onNavigate, className }: MessageRendererProps) {
  const cleanText = normalizeMarkdown(text);

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none min-w-0 leading-[1.6] font-medium ${className || "text-[15px]"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground mt-3 mb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground mt-2.5 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground mt-2 mb-1">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1.5 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 last:mb-0 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 last:mb-0 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-black text-primary/90">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 my-2 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-muted/60 text-primary text-[12px] font-mono px-1.5 py-0.5 rounded border border-border/40">
              {children}
            </code>
          ),
          hr: () => <hr className="my-3 border-border/50" />,
          a: ({ href, children }) => {
            const label = String(children || "");
            const internalRoute = resolveToInternalRoute(href || "", label);

            if (internalRoute && VALID_APP_ROUTES.has(internalRoute)) {
              return (
                <InternalLinkChip 
                  to={internalRoute} 
                  label={label || internalRoute} 
                  onClick={onNavigate} 
                />
              );
            }

            // Never render external links or non-existent URLs in DawaGPT.
            // If unmapped, render safe formatted text.
            return <span className="font-semibold text-foreground">{children}</span>;
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-xl border border-border/50">
              <table className="w-full text-sm text-left border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          th: ({ children }) => <th className="px-4 py-2 border-b border-border/50 font-bold">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2 border-b border-border/50">{children}</td>,
        }}
      >
        {cleanText}
      </ReactMarkdown>
    </div>
  );
}
