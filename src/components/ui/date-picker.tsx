import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "@/lib/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  value?: Date | string | null;
  onChange: (date: Date | undefined, dateStr?: string) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  fromYear?: number;
  toYear?: number;
  className?: string;
  id?: string;
  clearable?: boolean;
  showPresets?: boolean;
}

export function AppleDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabled,
  fromYear = 1920,
  toYear = new Date().getFullYear() + 5,
  className,
  id,
  clearable = true,
  showPresets = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - offset * 60 * 1000);
      const dateStr = localDate.toISOString().split("T")[0];
      onChange(date, dateStr);
    } else {
      onChange(undefined, "");
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined, "");
  };

  const presets = [
    { label: "Today", date: new Date() },
    { label: "Tomorrow", date: new Date(Date.now() + 86400000) },
    { label: "In 1 Week", date: new Date(Date.now() + 7 * 86400000) },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "w-full h-11 px-4 rounded-full border border-border bg-card hover:bg-secondary/60 text-foreground transition-all flex items-center justify-between text-sm font-semibold tracking-tight active:scale-95 select-none focus:outline-hidden focus:ring-2 focus:ring-primary/20",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <CalendarIcon size={14} />
            </div>
            <span className={cn(selectedDate ? "text-foreground" : "text-muted-foreground font-normal")}>
              {selectedDate ? format(selectedDate, "MMMM d, yyyy") : placeholder}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {clearable && selectedDate && (
              <span
                role="button"
                onClick={handleClear}
                aria-label="Clear date"
                className="w-5 h-5 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              >
                <X size={11} strokeWidth={2.5} />
              </span>
            )}
            <div className="px-2 py-0.5 rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground border border-border">
              {selectedDate ? format(selectedDate, "MMM d") : "Pick"}
            </div>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-auto p-4 rounded-[20px] border-border bg-card/95 backdrop-blur-xl shadow-xl z-50 space-y-3"
      >
        {showPresets && (
          <div className="flex items-center gap-1.5 pb-2 border-b border-border">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSelect(p.date)}
                className="flex-1 py-1 px-2 rounded-full bg-secondary hover:bg-secondary/80 text-[11px] font-semibold text-muted-foreground hover:text-foreground border border-border transition-transform active:scale-95 text-center"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={disabled}
          initialFocus
          fromYear={fromYear}
          toYear={toYear}
          captionLayout="dropdown-buttons"
        />
      </PopoverContent>
    </Popover>
  );
}

export { AppleDatePicker as DatePicker };
export default AppleDatePicker;
