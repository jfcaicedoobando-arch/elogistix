import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiStripProps {
  children: ReactNode;
  /** Columnas en desktop (≥xl). Default 6. */
  desktopCols?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const DESKTOP_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

/**
 * Banda de KPIs responsive:
 * - `<sm`: carrusel horizontal con scroll-snap (cards ~78% del ancho)
 * - `≥sm`: grid según `desktopCols`
 */
export function KpiStrip({ children, desktopCols = 6, className }: KpiStripProps) {
  return (
    <div
      className={cn(
        // Mobile: carrusel snap
        "flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-4 px-4 pb-2",
        "[&>*]:snap-start [&>*]:shrink-0 [&>*]:w-[78%]",
        // Desktop: grid (resetea reglas móviles)
        "sm:grid sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0",
        "sm:[&>*]:w-auto sm:[&>*]:shrink",
        DESKTOP_COLS[desktopCols],
        className,
      )}
    >
      {children}
    </div>
  );
}
