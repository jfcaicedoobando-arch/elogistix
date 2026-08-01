/**
 * Filtros de Embarques — migrado a `<UnifiedFiltersBar>` (Oleada 1).
 *
 * Primary (siempre visible): Estado + Cliente.
 * Secondary (Sheet): Modo, Operador, ETD desde, ETA hasta.
 * Chips activos generados de los valores actuales del filtro.
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import type { ChipItem } from "@/hooks/shared/useTableFilters";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { ESTADOS_EMBARQUE, MODOS_TRANSPORTE } from "@/features/embarques/constants/embarqueConstants";
import { labelEstadoEmbarque } from "@/features/embarques/constants/estadoEmbarqueLabels";
import { formatDate } from "@/lib/formatters";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL, rangoLabel } from "@/lib/ui/rangoFechasCopy";

interface ClienteOption { id: string; nombre: string }

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
  const {
    search, onSearchChange,
    filterModo, filterEstado, filterCliente, filterOperador,
    fechaDesde, fechaHasta,
    onFilterModoChange, onFilterEstadoChange, onFilterClienteChange,
    onFilterOperadorChange, onFechaDesdeChange, onFechaHastaChange,
    clientes, operadores,
  } = props;

  // Chips activos (UnifiedFiltersBar maneja search aparte)
  const chips: ChipItem[] = [];
  if (filterEstado !== "todos") {
    chips.push({ key: "estado", label: `Estado: ${filterEstado}`, onRemove: () => onFilterEstadoChange("todos") });
  }
  if (filterCliente !== "todos") {
    const nombre = clientes.find((c) => c.id === filterCliente)?.nombre ?? filterCliente;
    chips.push({ key: "cliente", label: `Cliente: ${nombre}`, onRemove: () => onFilterClienteChange("todos") });
  }
  if (filterModo !== "todos") {
    chips.push({ key: "modo", label: `Modo: ${filterModo}`, onRemove: () => onFilterModoChange("todos") });
  }
  if (filterOperador !== "todos") {
    chips.push({ key: "operador", label: `Operador: ${filterOperador}`, onRemove: () => onFilterOperadorChange("todos") });
  }
  if (fechaDesde) {
    chips.push({ key: "desde", label: `ETD desde: ${formatDate(fechaDesde)}`, onRemove: () => onFechaDesdeChange("") });
  }
  if (fechaHasta) {
    chips.push({ key: "hasta", label: `ETA hasta: ${formatDate(fechaHasta)}`, onRemove: () => onFechaHastaChange("") });
  }

  const secondaryCount = [filterModo !== "todos", filterOperador !== "todos", !!fechaDesde, !!fechaHasta]
    .filter(Boolean).length;

  const clearAll = () => {
    onFilterModoChange("todos"); onFilterEstadoChange("todos");
    onFilterClienteChange("todos"); onFilterOperadorChange("todos");
    onFechaDesdeChange(""); onFechaHastaChange("");
  };

  return (
    <UnifiedFiltersBar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar por expediente, cliente o mercancía..."
      chips={chips}
      activeCount={secondaryCount}
      onClearAll={clearAll}
      primary={
        <>
          <Select value={filterEstado} onValueChange={onFilterEstadoChange}>
            <SelectTrigger className="w-[170px]" aria-label="Estado del embarque">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {ESTADOS_EMBARQUE.map((e) => <SelectItem key={e} value={e}>{labelEstadoEmbarque(e)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCliente} onValueChange={onFilterClienteChange}>
            <SelectTrigger className="w-[210px]" aria-label="Cliente">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los clientes</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre.split(" ").slice(0, 3).join(" ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      secondary={
        <div className="space-y-4">
          <FieldGroup label="Modo de transporte">
            <Select value={filterModo} onValueChange={onFilterModoChange}>
              <SelectTrigger className="w-full" aria-label="Modo de transporte">
                <SelectValue placeholder="Modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los modos</SelectItem>
                {MODOS_TRANSPORTE.map((m) => (
                  <SelectItem key={m} value={m}>
                    <span className="inline-flex items-center gap-2">
                      <ModoIcon modo={m} size={14} /> {m}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Operador">
            <Select value={filterOperador} onValueChange={onFilterOperadorChange}>
              <SelectTrigger className="w-full" aria-label="Operador">
                <SelectValue placeholder="Operador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los operadores</SelectItem>
                {operadores.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label={rangoLabel("ETD", "desde")}>
            <DatePickerMx value={fechaDesde} onChange={onFechaDesdeChange} className="w-full" />
          </FieldGroup>
          <FieldGroup label={rangoLabel("ETA", "hasta")}>
            <DatePickerMx value={fechaHasta} onChange={onFechaHastaChange} className="w-full" />
          </FieldGroup>
        </div>
      }
    />
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
