/**
 * Shell reutilizable para los filtros mobile del portal / listados.
 *
 * Encapsula el patrón repetido: `<Input search>` + botón `Filtros` con badge de
 * conteo activo + `<Sheet>` lateral con header/body/footer y acciones Limpiar/Aplicar.
 * Los campos concretos van como `children`.
 *
 * DRY Lote 8b — reemplaza el markup duplicado en:
 *   - PortalFacturasMobileFilters
 *   - PortalEmbarquesMobileFilters
 *   - PortalCotizacionesMobileFilters
 */
import { useState, type ReactNode } from "react";
import { Filter, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { mobileFilterSheet } from "@/components/shared/utils/dialogTokens";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";

interface MobileFilterSheetProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  title: string;
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
}

export function MobileFilterSheet({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  title,
  activeCount,
  onClear,
  children,
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex gap-2 sm:hidden">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="shrink-0 gap-2">
            <Filter className="h-4 w-4" />
            Filtros
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">{children}</div>
          <SheetFooter className="p-4 border-t flex-row gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={onClear} disabled={activeCount === 0} className="gap-2">
              <X className="h-4 w-4" /> Limpiar
            </Button>
            <Button onClick={() => setOpen(false)}>Aplicar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
