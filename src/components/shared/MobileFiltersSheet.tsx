/**
 * Sheet lateral reutilizable para filtros en móvil (`<md`).
 *
 * Patrón consistente con `CotizacionesMobileFilters` ya en producción:
 * - Search visible siempre fuera del Sheet (acceso rápido).
 * - Botón "Filtros" con badge de conteo de filtros activos.
 * - Footer sticky con "Limpiar / Aplicar" y respeto a safe-area-inset-bottom.
 *
 * Cada página inyecta sus propios selects como `children`. Sin lógica.
 */
import type { ReactNode } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mobileFilterSheet } from "@/components/shared/utils/dialogTokens";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";

export interface MobileFiltersSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  activeCount: number;
  onClearAll: () => void;
  /** Trigger button label, default "Filtros". */
  triggerLabel?: string;
  /** Selects / inputs renderizados dentro del Sheet. */
  children: ReactNode;
}

export function MobileFiltersSheet({
  open,
  onOpenChange,
  title = "Filtros",
  activeCount,
  onClearAll,
  triggerLabel = "Filtros",
  children,
}: MobileFiltersSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="shrink-0 gap-2">
          <Filter className="h-4 w-4" />
          <span>{triggerLabel}</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className={mobileFilterSheet}>
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {children}
        </div>
        <SheetFooter className="p-4 border-t flex-row gap-2 sm:flex-row sm:justify-between pb-[max(env(safe-area-inset-bottom),1rem)]">
          <Button
            variant="ghost"
            onClick={onClearAll}
            disabled={activeCount === 0}
            className="gap-2"
          >
            <X className="h-4 w-4" /> Limpiar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Aplicar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
