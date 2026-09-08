import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * FIX 6 (P3): el locale por defecto es es-MX. Sin esto, los calendarios que no
 * lo pasaban explícitamente (p. ej. el wizard de cotización) mostraban los
 * meses y días de la semana en inglés.
 */
function Calendar({
  className, classNames, showOutsideDays = true, locale = es, ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        // v13.389.2 — `captionLayout="dropdown"` renderizaba los <select>
        // nativos sin estilo junto al texto del mes (se veía "agosto agosto ›").
        // Los selects quedan como overlay invisible sobre una píldora estilizada.
        month_caption: "flex h-9 items-center justify-center pt-1 relative",
        caption_label: "inline-flex items-center gap-1 text-body font-medium",
        dropdowns: "flex items-center gap-1.5",
        dropdown_root:
          "relative inline-flex items-center rounded-md border border-input bg-background px-2 py-1 text-body font-medium hover:bg-accent hover:text-accent-foreground focus-within:ring-2 focus-within:ring-ring",
        dropdown: "absolute inset-0 h-full w-full cursor-pointer opacity-0",
        months_dropdown: "capitalize",
        nav: "space-x-1 flex items-center absolute inset-x-1 top-1 justify-between",

        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-body p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
        ),
        range_end: "day-range-end",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground",
        // VIS-20260908-02: `bg-accent` es el mismo azul que `bg-primary` en el
        // tema oscuro, así que "hoy" y el día seleccionado se veían idénticos
        // (parecían dos selecciones). El relleno principal queda reservado a
        // la selección; hoy se distingue con un aro y texto en énfasis, y sólo
        // mientras NO esté seleccionado (si hoy = seleccionado, gana selección).
        // REM-VIS-02: `aria-selected`/`data-selected` los pone react-day-picker en
        // la CELDA (gridcell), no en el botón; el guard anterior consultaba el
        // botón (siempre sin aria) y por eso "hoy seleccionado" recibía también
        // `text-primary` sobre el relleno primary (texto casi invisible al
        // perder foco). Ahora el guard se evalúa en la celda.
        today: [
          "[&:not([aria-selected='true']):not([data-selected='true'])>button]:ring-1",
          "[&:not([aria-selected='true']):not([data-selected='true'])>button]:ring-inset",
          "[&:not([aria-selected='true']):not([data-selected='true'])>button]:ring-primary",
          "[&:not([aria-selected='true']):not([data-selected='true'])>button]:text-primary",
          "[&:not([aria-selected='true']):not([data-selected='true'])>button]:font-semibold",
        ].join(" "),
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") return <ChevronLeft className="h-4 w-4" />;
          if (orientation === "right") return <ChevronRight className="h-4 w-4" />;
          // Orientación "down"/"up": chevron de los dropdowns de mes/año.
          return <ChevronDown className="h-3.5 w-3.5 opacity-60" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
