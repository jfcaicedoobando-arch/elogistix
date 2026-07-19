/**
 * Filtros de Proformas — barra compacta con chips de activos.
 *
 * Homologa el patrón usado en `/embarques` (`EmbarquesFiltros`):
 *   Desktop (md+): [Search][Estado][Cliente][Filtros (N)]
 *                  N = secundarios activos (Operador + rango fecha).
 *   Mobile  (<md): [Search][Filtros (N)]
 *                  N = TODOS los filtros activos.
 * Debajo se pintan chips con X individual y "Limpiar todo".
 */
import { useState } from "react";
import { Filter, X } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SearchInput from "@/components/shared/SearchInput";
import { ProformasFiltrosCampos } from "./ProformasFiltrosCampos";
import { ProformasFiltrosChips } from "./ProformasFiltrosChips";
import { mobileFilterSheet } from "@/components/shared/utils/dialogTokens";

interface ClienteOption { id: string; nombre: string }

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filtroEstado: string;
  onFiltroEstadoChange: (v: string) => void;
  filtroCliente: string;
  onFiltroClienteChange: (v: string) => void;
  filtroOperador: string;
  onFiltroOperadorChange: (v: string) => void;
  fechaDesde: string;
  onFechaDesdeChange: (v: string) => void;
  fechaHasta: string;
  onFechaHastaChange: (v: string) => void;
  clientes: ClienteOption[];
  operadores: string[];
  onClearAll: () => void;
}

function countActive(v: {
  filtroEstado: string; filtroCliente: string; filtroOperador: string;
  fechaDesde: string; fechaHasta: string;
}): number {
  let n = 0;
  if (v.filtroEstado && v.filtroEstado !== "todas") n++;
  if (v.filtroCliente && v.filtroCliente !== "todos") n++;
  if (v.filtroOperador && v.filtroOperador !== "todos") n++;
  if (v.fechaDesde) n++;
  if (v.fechaHasta) n++;
  return n;
}

export default function ProformasFiltros(props: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const totalActive = countActive({
    filtroEstado: props.filtroEstado,
    filtroCliente: props.filtroCliente,
    filtroOperador: props.filtroOperador,
    fechaDesde: props.fechaDesde,
    fechaHasta: props.fechaHasta,
  });

  const secondaryActive = countActive({
    filtroEstado: "todas",
    filtroCliente: "todos",
    filtroOperador: props.filtroOperador,
    fechaDesde: props.fechaDesde,
    fechaHasta: props.fechaHasta,
  });

  const FilterButton = ({ count, className }: { count: number; className?: string }) => (
    <SheetTrigger asChild>
      <Button variant="outline" size="default" className={`shrink-0 gap-2 ${className ?? ""}`}>
        <Filter className="h-4 w-4" />
        <span>Filtros</span>
        {count > 0 && (
          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-label">
            {count}
          </Badge>
        )}
      </Button>
    </SheetTrigger>
  );

  return (
    <div className="space-y-0">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {/* Mobile + tableta (<lg): search + Filtros (todos) — evita que los selects se aplasten en 768px */}
        <div className="flex gap-2 lg:hidden">
          <SearchInput
            value={props.search}
            onChange={props.onSearchChange}
            placeholder="Buscar proformas..."
            className="flex-1 min-w-0"
          />
          <FilterButton count={totalActive} />
        </div>

        {/* Desktop (lg+): search + Estado + Cliente + Filtros (secundarios) */}
        <div className="hidden lg:flex lg:items-center lg:gap-2">
          <ProformasFiltrosCampos {...props} layout="inline" />
          <FilterButton count={secondaryActive} />
        </div>

        <SheetContent side="right" className={mobileFilterSheet}>
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Filtros de proformas</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="lg:hidden">
              <ProformasFiltrosCampos {...props} layout="stacked-all" />
            </div>
            <div className="hidden lg:block">
              <ProformasFiltrosCampos {...props} layout="stacked-secondary" />
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

      <ProformasFiltrosChips
        filtroEstado={props.filtroEstado}
        onFiltroEstadoChange={props.onFiltroEstadoChange}
        filtroCliente={props.filtroCliente}
        onFiltroClienteChange={props.onFiltroClienteChange}
        filtroOperador={props.filtroOperador}
        onFiltroOperadorChange={props.onFiltroOperadorChange}
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
