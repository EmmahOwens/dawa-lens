import { cn } from "@/lib/utils";

type Variant = "blue" | "green" | "amber" | "red" | "violet" | "cyan" | "muted";

const styles: Record<Variant, string> = {
  blue:   "bg-[rgba(10,132,255,0.12)]   text-[#0a84ff]  border-[rgba(10,132,255,0.25)]",
  green:  "bg-[rgba(48,209,88,0.12)]    text-[#30d158]  border-[rgba(48,209,88,0.25)]",
  amber:  "bg-[rgba(255,214,10,0.12)]   text-[#ffd60a]  border-[rgba(255,214,10,0.25)]",
  red:    "bg-[rgba(255,69,58,0.12)]    text-[#ff453a]  border-[rgba(255,69,58,0.25)]",
  violet: "bg-[rgba(191,90,242,0.12)]   text-[#bf5af2]  border-[rgba(191,90,242,0.25)]",
  cyan:   "bg-[rgba(90,200,250,0.12)]   text-[#5ac8fa]  border-[rgba(90,200,250,0.25)]",
  muted:  "bg-[#111827]                 text-[#6e7585]  border-white/[0.07]",
};

type Props = { variant?: Variant; children: React.ReactNode; className?: string };

export function AdminBadge({ variant = "muted", children, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[5px] border px-[7px] py-[3px]",
        "font-mono text-[10px] font-semibold tracking-[0.03em]",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
