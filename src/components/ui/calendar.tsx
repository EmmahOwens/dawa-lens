import * as React from "react";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center pt-1 pb-2 relative items-center",
        caption_label: "text-sm font-semibold tracking-tight text-foreground",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-card border-border p-0 rounded-full hover:bg-secondary transition-transform active:scale-90 text-foreground",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex justify-between",
        head_cell: "text-muted-foreground w-9 font-medium text-[11px] uppercase tracking-wider text-center",
        row: "flex w-full mt-1.5 justify-between",
        cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day: cn(
          "h-9 w-9 p-0 font-medium rounded-full hover:bg-secondary text-foreground text-xs flex items-center justify-center transition-all active:scale-95",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "!bg-primary !text-primary-foreground hover:!bg-primary hover:!text-primary-foreground font-semibold shadow-xs",
        day_today: "border border-primary/40 text-foreground font-semibold",
        day_outside:
          "text-muted-foreground/40 opacity-50 aria-selected:bg-primary/20 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground/30 opacity-40 cursor-not-allowed hover:bg-transparent",
        day_range_middle: "aria-selected:bg-secondary aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
