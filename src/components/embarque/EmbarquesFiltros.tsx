/**
 * v8.99.41 / v8.100.1 — Filtros responsive de Embarques.
 *
 * Desktop (md+): render inline (search + 5 selects + 2 fechas).
 * Mobile (<md): SearchInput + botón "Filtros (N)" que abre un Sheet con todos los campos.
 *
 * Este archivo ahora es un ensamblador delgado:
 *   - Campos de filtros → `EmbarquesFiltrosCampos`
 *   - Conteo de activos → `countActiveEmbarqueFilters`
 */
import { useState } from "react";
import { Filter, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SearchInput from "@/components/selects/SearchInput";
import { EmbarquesFiltrosCampos } from "./EmbarquesFiltrosCampos";
import { countActiveEmbarqueFilters } from "./embarquesFiltrosUtils";

interface ClienteOption {
  id: string;
  nombre: string;
}

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filterModo: string;
  onFilterModoChange: (v: string) => void;
  filterEstado: string;
  onFilterEstadoChange: (v: string) => void;
  filterCliente: string;
  onFilterClienteChange: (v: string) => void;
  filterOperador: string;
  onFilterOperadorChange: (v: string) => void;
  fechaDesde: string;
  onFechaDesdeChange: (v: string) => void;
  fechaHasta: string;
  onFechaHastaChange: (v: string) => void;
  clientes: ClienteOption[];
  operadores: string[];
}


export default function EmbarquesFiltros(props: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeFilterCount = countActiveEmbarqueFilters({
    filterModo: props.filterModo,
    filterEstado: props.filterEstado,
    filterCliente: props.filterCliente,
    filterOperador: props.filterOperador,
    filterProforma: props.filterProforma,
    fechaDesde: props.fechaDesde,
    fechaHasta: props.fechaHasta,
  });

  const clearAll = () => {
    props.onFilterModoChange("todos");
    props.onFilterEstadoChange("todos");
    props.onFilterClienteChange("todos");
    props.onFilterOperadorChange("todos");
    props.onFilterProformaChange("todos");
    props.onFechaDesdeChange("");
    props.onFechaHastaChange("");
  };

  return (
    <>
      {/* Mobile: search + botón "Filtros (N)" → Sheet */}
      <div className="flex gap-2 md:hidden">
        <SearchInput
          value={props.search}
          onChange={props.onSearchChange}
          placeholder="Buscar embarques..."
          className="flex-1 min-w-0"
        />
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="default" className="shrink-0 gap-2">
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
              <SheetTitle>Filtros de embarques</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <EmbarquesFiltrosCampos {...props} layout="stacked" />
            </div>
            <SheetFooter className="p-4 border-t flex-row gap-2 sm:flex-row sm:justify-between">
              <Button
                variant="ghost"
                onClick={clearAll}
                disabled={activeFilterCount === 0}
                className="gap-2"
              >
                <X className="h-4 w-4" /> Limpiar
              </Button>
              <Button onClick={() => setSheetOpen(false)}>Aplicar</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop md+: layout inline */}
      <EmbarquesFiltrosCampos {...props} layout="inline" />
    </>
  );
}
