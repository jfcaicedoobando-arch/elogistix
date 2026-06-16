/**
 * Chips de filtros activos para el listado de Embarques.
 * Muestra cada filtro aplicado como un Badge removible y un botón "Limpiar todo".
 * No incluye el `search` (tiene su propio input visible).
 */
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";

interface ClienteOption {
  id: string;
  nombre: string;
}

export interface EmbarquesFiltrosChipsProps {
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
  onClearAll: () => void;
}

interface ChipDef {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export function EmbarquesFiltrosChips(props: EmbarquesFiltrosChipsProps) {
  const chips: ChipDef[] = [];

  if (props.filterEstado && props.filterEstado !== "todos") {
    chips.push({
      key: "estado",
      label: "Estado",
      value: props.filterEstado,
      onRemove: () => props.onFilterEstadoChange("todos"),
    });
  }
  if (props.filterCliente && props.filterCliente !== "todos") {
    const cliente = props.clientes.find((c) => c.id === props.filterCliente);
    chips.push({
      key: "cliente",
      label: "Cliente",
      value: cliente?.nombre ?? "—",
      onRemove: () => props.onFilterClienteChange("todos"),
    });
  }
  if (props.filterModo && props.filterModo !== "todos") {
    chips.push({
      key: "modo",
      label: "Modo",
      value: props.filterModo,
      onRemove: () => props.onFilterModoChange("todos"),
    });
  }
  if (props.filterOperador && props.filterOperador !== "todos") {
    chips.push({
      key: "operador",
      label: "Operador",
      value: props.filterOperador,
      onRemove: () => props.onFilterOperadorChange("todos"),
    });
  }
  if (props.fechaDesde) {
    chips.push({
      key: "fechaDesde",
      label: "ETD desde",
      value: formatDate(props.fechaDesde),
      onRemove: () => props.onFechaDesdeChange(""),
    });
  }
  if (props.fechaHasta) {
    chips.push({
      key: "fechaHasta",
      label: "ETA hasta",
      value: formatDate(props.fechaHasta),
      onRemove: () => props.onFechaHastaChange(""),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-2 pt-3 mt-3 border-t border-border">
      <span className="text-xs font-medium text-muted-foreground">Activos:</span>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pr-1 pl-2 py-1 text-xs font-normal"
        >
          <span className="text-muted-foreground">{chip.label}:</span>
          <span className="font-medium truncate max-w-[180px]">{chip.value}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Quitar filtro ${chip.label}`}
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-sm hover:bg-background/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={props.onClearAll}
        className="ml-auto h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        Limpiar todo
      </Button>
    </div>
  );
}
