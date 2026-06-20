/**
 * Filtros de Embarques — barra compacta con chips de activos.
 *
 * Desktop (md+):
 *   [ Search ][ Estado ][ Cliente ][ Filtros (N) ]   ← N cuenta secundarios
 *   El botón "Filtros" abre un Sheet con Modo, Operador, ETD desde, ETA hasta.
 *
 * Mobile (<md):
 *   [ Search ][ Filtros (N) ]                        ← N cuenta TODOS
 *   El sheet incluye también Estado y Cliente.
 *
 * Debajo: chips de filtros activos con X individual y "Limpiar todo".
 */
import { useState } from "react";
import { Filter, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SearchInput from "@/components/shared/SearchInput";
import { EmbarquesFiltrosCampos } from "./EmbarquesFiltrosCampos";
import { EmbarquesFiltrosChips } from "./EmbarquesFiltrosChips";
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

  const totalActive = countActiveEmbarqueFilters({
    filterModo: props.filterModo,
    filterEstado: props.filterEstado,
    filterCliente: props.filterCliente,
    filterOperador: props.filterOperador,
    fechaDesde: props.fechaDesde,
    fechaHasta: props.fechaHasta,
  });

  // En desktop el sheet solo expone los secundarios (Modo, Operador, fechas).
  const secondaryActive = countActiveEmbarqueFilters({
    filterModo: props.filterModo,
    filterEstado: "todos",
    filterCliente: "todos",
    filterOperador: props.filterOperador,
    fechaDesde: props.fechaDesde,
    fechaHasta: props.fechaHasta,
  });

  const clearAll = () => {
    props.onFilterModoChange("todos");
    props.onFilterEstadoChange("todos");
    props.onFilterClienteChange("todos");
    props.onFilterOperadorChange("todos");
    props.onFechaDesdeChange("");
    props.onFechaHastaChange("");
  };

  const FilterButton = ({ count, className }: { count: number; className?: string }) => (
    <SheetTrigger asChild>
      <Button variant="outline" size="default" className={`shrink-0 gap-2 ${className ?? ""}`}>
        <Filter className="h-4 w-4" />
        <span>Filtros</span>
        {count > 0 && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px]">
            {count}
          </Badge>
        )}
      </Button>
    </SheetTrigger>
  );

  return (
    <div className="space-y-0">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {/* Mobile: search + Filtros (todos) */}
        <div className="flex gap-2 md:hidden">
          <SearchInput
            value={props.search}
            onChange={props.onSearchChange}
            placeholder="Buscar embarques..."
            className="flex-1 min-w-0"
          />
          <FilterButton count={totalActive} />
        </div>

        {/* Desktop: search + Estado + Cliente + Filtros (secundarios) */}
        <div className="hidden md:flex md:items-center md:gap-2">
          <EmbarquesFiltrosCampos {...props} layout="inline" />
          <FilterButton count={secondaryActive} />
        </div>

        <SheetContent side="right" className="w-full max-w-sm flex flex-col gap-0 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Filtros de embarques</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {/* En móvil mostramos todos; en desktop solo los secundarios */}
            <div className="md:hidden">
              <EmbarquesFiltrosCampos {...props} layout="stacked-all" />
            </div>
            <div className="hidden md:block">
              <EmbarquesFiltrosCampos {...props} layout="stacked-secondary" />
            </div>
          </div>
          <SheetFooter className="p-4 border-t flex-row gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              onClick={clearAll}
              disabled={totalActive === 0}
              className="gap-2"
            >
              <X className="h-4 w-4" /> Limpiar
            </Button>
            <Button onClick={() => setSheetOpen(false)}>Aplicar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Chips de filtros activos */}
      <EmbarquesFiltrosChips
        filterModo={props.filterModo}
        onFilterModoChange={props.onFilterModoChange}
        filterEstado={props.filterEstado}
        onFilterEstadoChange={props.onFilterEstadoChange}
        filterCliente={props.filterCliente}
        onFilterClienteChange={props.onFilterClienteChange}
        filterOperador={props.filterOperador}
        onFilterOperadorChange={props.onFilterOperadorChange}
        fechaDesde={props.fechaDesde}
        onFechaDesdeChange={props.onFechaDesdeChange}
        fechaHasta={props.fechaHasta}
        onFechaHastaChange={props.onFechaHastaChange}
        clientes={props.clientes}
        onClearAll={clearAll}
      />
    </div>
  );
}
