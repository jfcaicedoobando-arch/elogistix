/**
 * Campos de filtros para el listado de Facturas emitidas.
 * Mismo patrón que `ProformasFiltrosCampos`:
 *   - `inline`             → barra desktop: search + Estado + Cliente
 *   - `stacked-all`        → sheet mobile: todos con labels
 *   - `stacked-secondary`  → sheet desktop: rango de fecha de emisión
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/shared/SearchInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import type { Database } from "@/types/db";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = [
  "Borrador", "Por timbrar", "Emitida", "Parcialmente pagada", "Pagada", "Vencida", "Cancelada",
];

interface ClienteOption { id: string; nombre: string }

export interface FacturasFiltrosCamposProps {
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
  layout: "inline" | "stacked-all" | "stacked-secondary";
}

export function FacturasFiltrosCampos(props: FacturasFiltrosCamposProps) {
  const EstadoSelect = (
    <Select value={props.filtroEstado} onValueChange={props.onFiltroEstadoChange}>
      <SelectTrigger className="w-full md:w-[180px]" title="Filtrar por estado" aria-label="Estado de la factura">
        <SelectValue placeholder="Estado" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los estados</SelectItem>
        {ESTADOS_FACTURA.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
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

  const FechaDesde = (
    <DatePickerMx
      value={props.fechaDesde}
      onChange={props.onFechaDesdeChange}
      className="w-full"
      placeholder="Desde"
      title="Emitida desde"
    />
  );

  const FechaHasta = (
    <DatePickerMx
      value={props.fechaHasta}
      onChange={props.onFechaHastaChange}
      className="w-full"
      placeholder="Hasta"
      title="Emitida hasta"
    />
  );

  if (props.layout === "inline") {
    return (
      <>
        <SearchInput
          value={props.search}
          onChange={props.onSearchChange}
          placeholder="Buscar factura o cliente..."
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
        <FieldGroup label="Emitida desde">{FechaDesde}</FieldGroup>
        <FieldGroup label="Emitida hasta">{FechaHasta}</FieldGroup>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FieldGroup label="Estado">{EstadoSelect}</FieldGroup>
      <FieldGroup label="Cliente">{ClienteSelect}</FieldGroup>
      <FieldGroup label="Emitida desde">{FechaDesde}</FieldGroup>
      <FieldGroup label="Emitida hasta">{FechaHasta}</FieldGroup>
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
