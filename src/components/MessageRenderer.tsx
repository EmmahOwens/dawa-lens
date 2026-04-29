import React from "react";
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
} from "lucide-react";

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
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[13px] font-semibold hover:bg-primary/20 hover:border-primary/40 active:scale-95 transition-all mx-0.5 no-underline"
    >
      <Icon size={12} className="shrink-0" />
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
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border/50 text-foreground text-[13px] font-semibold hover:bg-muted hover:border-border active:scale-95 transition-all mx-0.5 no-underline"
    >
      {label}
      <ExternalLink size={11} className="shrink-0 opacity-60" />
    </a>
  );
}

/**
 * Parses text containing [Label](/route) or [Label](https://...) syntax
 * and renders internal routes as styled React Router chips,
 * and external URLs as anchor chips.
 *
 * Everything else is rendered as a plain text span preserving whitespace.
 */
interface MessageRendererProps {
  text: string;
  /** Called when an internal link chip is clicked (e.g. to close the chat panel). */
  onNavigate?: () => void;
}

export default function MessageRenderer({ text, onNavigate }: MessageRendererProps) {
  // Regex: [Any text](/path) or [Any text](https://...)
  const LINK_RE = /\[([^\]]+)\]\((\/[^\s)]*|https?:\/\/[^\s)]*)\)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = LINK_RE.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index);
      parts.push(
        <span key={key++} className="whitespace-pre-wrap">
          {segment}
        </span>
      );
    }

    const label = match[1];
    const href = match[2];

    if (href.startsWith("/")) {
      parts.push(
        <InternalLinkChip key={key++} to={href} label={label} onClick={onNavigate} />
      );
    } else {
      parts.push(<ExternalLinkChip key={key++} href={href} label={label} />);
    }

    lastIndex = match.index + match[0].length;
  }

  // Push any remaining text after the last link
  if (lastIndex < text.length) {
    parts.push(
      <span key={key++} className="whitespace-pre-wrap">
        {text.slice(lastIndex)}
      </span>
    );
  }

  // No links found — render as simple text
  if (parts.length === 0) {
    return (
      <p className="text-[15px] leading-[1.6] font-medium whitespace-pre-wrap">{text}</p>
    );
  }

  return (
    <p className="text-[15px] leading-[1.6] font-medium">
      {parts}
    </p>
  );
}
