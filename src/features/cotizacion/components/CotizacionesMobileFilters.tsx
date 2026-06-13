import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import SearchInput from "@/components/selects/SearchInput";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  search: string;
  onSearchChange: (v: string) => void;
  activeFilterCount: number;
  onClearAll: () => void;
  estadoSelect: ReactNode;
  clienteSelect: ReactNode;
}

export function CotizacionesMobileFilters({
  open,
  onOpenChange,
  search,
  onSearchChange,
  activeFilterCount,
  onClearAll,
  estadoSelect,
  clienteSelect,
}: Props) {
  return (
    <div className="flex gap-2 md:hidden">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Buscar..."
        className="flex-1 min-w-0"
      />
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <Button variant="outline" className="shrink-0 gap-2">
            <Filter className="h-4 w-4" />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full max-w-sm flex flex-col gap-0 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Filtros de cotizaciones</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              {estadoSelect}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cliente</label>
              {clienteSelect}
            </div>
          </div>
          <SheetFooter className="p-4 border-t flex-row gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={onClearAll} disabled={activeFilterCount === 0} className="gap-2">
              <X className="h-4 w-4" /> Limpiar
            </Button>
            <Button onClick={() => onOpenChange(false)}>Aplicar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
