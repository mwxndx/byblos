import * as React from "react";
import { ChevronLeft, ChevronRight } from '@/shared/ui/icons';
import { DayPicker } from "react-day-picker";

import { cn } from "@/shared/utils/formatting";
import { buttonVariants } from "@/shared/ui/buttonVariants";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        // Day numerals carry explicit dark: variants so the primitive is
        // dark-mode-safe by default -- without them, black-on-dark text is
        // effectively invisible and every consumer has to re-supply its own
        // dark overrides (WCAG 1.4.3 Contrast).
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal text-black hover:text-black hover:bg-gray-100 dark:text-white dark:hover:text-white dark:hover:bg-white/10 aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white",
        day_today: "bg-accent text-black dark:text-white font-medium",
        day_outside:
          "text-black dark:text-white opacity-70 hover:bg-gray-100 dark:hover:bg-white/10 aria-selected:bg-primary/80 aria-selected:text-white",
        day_disabled: "text-gray-300 opacity-50 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-primary/50 aria-selected:text-white",
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


