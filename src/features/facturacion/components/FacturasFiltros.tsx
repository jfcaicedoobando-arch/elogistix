/**
 * Filtros de Facturas emitidas — barra compacta con chips de activos.
 * Homologa el patrón `EmbarquesFiltros` / `ProformasFiltros`.
 *   Desktop (md+): [Search][Estado][Cliente][Filtros (N)]  (N = secundarios)
 *   Mobile  (<md): [Search][Filtros (N)]                   (N = todos)
 */
import { useState } from "react";
import { Filter, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SearchInput from "@/components/shared/SearchInput";
import { FacturasFiltrosCampos } from "./FacturasFiltrosCampos";
import { FacturasFiltrosChips } from "./FacturasFiltrosChips";
import { mobileFilterSheet } from "@/components/shared/utils/dialogTokens";

interface ClienteOption { id: string; nombre: string }

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filtroEstado: string;
  onFiltroEstadoChange: (v: string) => void;
  filtroCliente: string;
  onFiltroClienteChange: (v: string) => void;
  fechaDesde: string;
  onFechaDesdeChange: (v: string) => void;
  fechaHasta: string;
  onFechaHastaChange: (v: string) => void;
  clientes: ClienteOption[];
  onClearAll: () => void;
}

function countActive(v: {
  filtroEstado: string; filtroCliente: string;
  fechaDesde: string; fechaHasta: string;
}): number {
  let n = 0;
  if (v.filtroEstado && v.filtroEstado !== "todos") n++;
  if (v.filtroCliente && v.filtroCliente !== "todos") n++;
  if (v.fechaDesde) n++;
  if (v.fechaHasta) n++;
  return n;
}

export default function FacturasFiltros(props: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const totalActive = countActive(props);
  const secondaryActive = countActive({
    filtroEstado: "todos",
    filtroCliente: "todos",
    fechaDesde: props.fechaDesde,
    fechaHasta: props.fechaHasta,
  });

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
        {/* Mobile */}
        <div className="flex gap-2 md:hidden">
          <SearchInput
            value={props.search}
            onChange={props.onSearchChange}
            placeholder="Buscar facturas..."
            className="flex-1 min-w-0"
          />
          <FilterButton count={totalActive} />
        </div>

        {/* Desktop */}
        <div className="hidden md:flex md:items-center md:gap-2">
          <FacturasFiltrosCampos {...props} layout="inline" />
          <FilterButton count={secondaryActive} />
        </div>

        <SheetContent side="right" className={mobileFilterSheet}>
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Filtros de facturas</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="md:hidden">
              <FacturasFiltrosCampos {...props} layout="stacked-all" />
            </div>
            <div className="hidden md:block">
              <FacturasFiltrosCampos {...props} layout="stacked-secondary" />
            </div>
          </div>
          <SheetFooter className="p-4 border-t flex-row gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              onClick={props.onClearAll}
              disabled={totalActive === 0}
              className="gap-2"
            >
              <X className="h-4 w-4" /> Limpiar
            </Button>
            <Button onClick={() => setSheetOpen(false)}>Aplicar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <FacturasFiltrosChips
        filtroEstado={props.filtroEstado}
        onFiltroEstadoChange={props.onFiltroEstadoChange}
        filtroCliente={props.filtroCliente}
        onFiltroClienteChange={props.onFiltroClienteChange}
        fechaDesde={props.fechaDesde}
        onFechaDesdeChange={props.onFechaDesdeChange}
        fechaHasta={props.fechaHasta}
        onFechaHastaChange={props.onFechaHastaChange}
        clientes={props.clientes}
        onClearAll={props.onClearAll}
      />
    </div>
  );
}
