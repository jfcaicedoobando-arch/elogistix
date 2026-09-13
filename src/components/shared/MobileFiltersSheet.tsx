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
import { useEffect, useRef, type ReactNode } from "react";
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
  /**
   * v13.823.341 — selección temporal: al abrir se toma una foto de los filtros
   * y si el panel se cierra sin pulsar "Aplicar" (X, Esc o clic fuera) se
   * restaura. Sólo "Aplicar" persiste la selección.
   */
  snapshot?: () => unknown;
  restore?: (foto: unknown) => void;
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
  snapshot,
  restore,
  children,
}: MobileFiltersSheetProps) {
  const fotoRef = useRef<unknown>(undefined);
  const aplicadoRef = useRef(false);

  useEffect(() => {
    if (open && snapshot) {
      fotoRef.current = snapshot();
      aplicadoRef.current = false;
    }
  }, [open, snapshot]);

  const handleOpenChange = (v: boolean) => {
    if (!v && !aplicadoRef.current && restore && fotoRef.current !== undefined) {
      restore(fotoRef.current);
    }
    onOpenChange(v);
  };

  /** Limpiar sí persiste: es una acción explícita, no una selección temporal. */
  const limpiar = () => {
    aplicadoRef.current = true;
    onClearAll();
  };

  const aplicar = () => {
    aplicadoRef.current = true;
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="shrink-0 gap-2">
          <Filter className="h-4 w-4" />
          <span>{triggerLabel}</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-label">
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
            onClick={limpiar}
            disabled={activeCount === 0}
            className="gap-2"
          >
            <X className="h-4 w-4" /> Limpiar
          </Button>
          <Button onClick={aplicar}>Aplicar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
