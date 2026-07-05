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
  ExternalLink,
  LucideIcon,
  Package,
} from "@/lib/icons";

/** Maps DawaGPT custom/alias routes to actual application page routes. */
const GPT_ROUTE_MAP: Record<string, string> = {
  "/dashboard": "/",
  "/home": "/",
  "/reminders": "/reminders",
  "/medications": "/reminders",
  "/medication-info": "/search",
  "/search": "/search",
  "/reminders/new": "/reminders/new",
  "/new-reminder": "/reminders/new",
  "/add-reminder": "/reminders/new",
  "/history": "/history",
  "/logs": "/history",
  "/interactions": "/interactions",
  "/safety": "/interactions",
  "/family": "/family",
  "/family-hub": "/family",
  "/travel": "/travel",
  "/travel-companion": "/travel",
  "/wellness": "/wellness",
  "/wellness-hub": "/wellness",
  "/report": "/report",
  "/reports": "/report",
  "/care-report": "/report",
  "/settings": "/settings",
  "/profile": "/settings",
  "/scan": "/scan",
  "/scan-medicine": "/scan",
  "/medvault": "/medvault",
  "/med-vault": "/medvault",
};

/** Maps known internal routes to an icon for the link chip. */
const ROUTE_ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/reminders": Bell,
  "/reminders/new": PlusCircle,
  "/history": History,
  "/interactions": Zap,
  "/family": Users,
  "/travel": Plane,
  "/wellness": Heart,
  "/report": FileText,
  "/settings": Settings,
  "/scan": ScanLine,
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
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted border border-border/60 text-foreground text-[12px] font-semibold hover:bg-muted/80 active:scale-95 transition-all mx-0.5 no-underline shadow-sm"
    >
      <Icon size={11} className="shrink-0 text-primary/70" />
      {label}
    </Link>
  );
}

interface ExternalLinkChipProps {
  href: string;
  label: string;
}

function ExternalLinkChip({ href, label }: ExternalLinkChipProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-background border border-border/60 text-muted-foreground text-[12px] font-semibold hover:bg-muted/50 active:scale-95 transition-all mx-0.5 no-underline shadow-sm"
    >
      {label}
      <ExternalLink size={10} className="shrink-0 opacity-40" />
    </a>
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

export default function MessageRenderer({ text, onNavigate, className }: MessageRendererProps) {
  // Hide internal action execution metadata from the user (Requirement 2.6)
  const cleanText = text.replace(/\[ACTION EXECUTED:.*?\]/g, '').trim();

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none leading-[1.6] font-medium ${className || "text-[15px]"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-black text-primary/90">{children}</strong>,
           a: ({ href, children }) => {
            if (!href) return <span>{children}</span>;
            const label = String(children);
            
            if (href.startsWith("/")) {
              // Resolve the custom route to an actual page route using GPT_ROUTE_MAP
              const resolvedRoute = GPT_ROUTE_MAP[href] || href;
              
              // Whitelist of valid routes existing in the application
              const validRoutes = [
                "/",
                "/reminders",
                "/reminders/new",
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
                "/medvault"
              ];
              
              if (validRoutes.includes(resolvedRoute)) {
                return (
                  <InternalLinkChip 
                    to={resolvedRoute} 
                    label={label} 
                    onClick={onNavigate} 
                  />
                );
              }
              
              // If it's an invalid internal route, render it as plain text to prevent broken links
              return <span className="font-medium text-foreground">{label}</span>;
            }
            return <ExternalLinkChip href={href} label={label} />;
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
        {text}
      </ReactMarkdown>
    </div>
  );
}
