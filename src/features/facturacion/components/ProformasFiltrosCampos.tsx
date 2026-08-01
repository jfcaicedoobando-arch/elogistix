/**
 * Campos de filtros para el listado de Proformas.
 * Componente puramente presentacional, mismo patrón que `EmbarquesFiltrosCampos`:
 *   - `inline`             → barra desktop: search + Estado + Cliente
 *   - `stacked-all`        → sheet mobile: todos con labels
 *   - `stacked-secondary`  → sheet desktop: Operador + rango de fecha de emisión
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/shared/SearchInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";
  ESTADOS_UNIFICADOS,
  LABEL_ESTADO_UNIFICADO,
} from "@/lib/domain/estadoUnificado";

interface ClienteOption { id: string; nombre: string }

export interface ProformasFiltrosCamposProps {
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
  layout: "inline" | "stacked-all" | "stacked-secondary";
}

export function ProformasFiltrosCampos(props: ProformasFiltrosCamposProps) {
  const EstadoSelect = (
    <Select value={props.filtroEstado} onValueChange={props.onFiltroEstadoChange}>
      <SelectTrigger className="w-full md:w-[180px]" title="Filtrar por estado" aria-label="Estado de la proforma">
        <SelectValue placeholder="Estado" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">Todos los estados</SelectItem>
        {ESTADOS_UNIFICADOS.map((e) => (
          <SelectItem key={e} value={e}>{LABEL_ESTADO_UNIFICADO[e]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const ClienteSelect = (
    <Select value={props.filtroCliente} onValueChange={props.onFiltroClienteChange}>
      <SelectTrigger className="w-full md:w-[210px]" title="Filtrar por cliente" aria-label="Cliente">
        <SelectValue placeholder="Cliente" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los clientes</SelectItem>
        {props.clientes.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nombre.split(" ").slice(0, 3).join(" ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const OperadorSelect = (
    <Select value={props.filtroOperador} onValueChange={props.onFiltroOperadorChange}>
      <SelectTrigger className="w-full" title="Filtrar por operador" aria-label="Operador">
        <SelectValue placeholder="Operador" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los operadores</SelectItem>
        {props.operadores.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const FechaDesde = (
    <DatePickerMx
      value={props.fechaDesde}
      onChange={props.onFechaDesdeChange}
      className="w-full"
      title={rangoLabel("Emisión", "desde")}
    />
  );

  const FechaHasta = (
    <DatePickerMx
      value={props.fechaHasta}
      onChange={props.onFechaHastaChange}
      className="w-full"
      title={rangoLabel("Emisión", "hasta")}
    />
  );

  if (props.layout === "inline") {
    return (
      <>
        <SearchInput
          value={props.search}
          onChange={props.onSearchChange}
          placeholder="Buscar por número, expediente, cliente o folio..."
          className="flex-1 min-w-[200px]"
        />
        {EstadoSelect}
        {ClienteSelect}
      </>
    );
  }

  if (props.layout === "stacked-secondary") {
    return (
      <div className="space-y-4">
        <FieldGroup label="Operador">{OperadorSelect}</FieldGroup>
        <FieldGroup label={rangoLabel("Emisión", "desde")}>{FechaDesde}</FieldGroup>
        <FieldGroup label={rangoLabel("Emisión", "hasta")}>{FechaHasta}</FieldGroup>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FieldGroup label="Estado">{EstadoSelect}</FieldGroup>
      <FieldGroup label="Cliente">{ClienteSelect}</FieldGroup>
      <FieldGroup label="Operador">{OperadorSelect}</FieldGroup>
      <FieldGroup label={rangoLabel("Emisión", "desde")}>{FechaDesde}</FieldGroup>
      <FieldGroup label={rangoLabel("Emisión", "hasta")}>{FechaHasta}</FieldGroup>
    </div>
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
