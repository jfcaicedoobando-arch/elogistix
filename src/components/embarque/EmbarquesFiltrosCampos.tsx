/**
 * Campos de filtros para listado de Embarques.
 * Componente puramente presentacional reutilizado en desktop (inline) y
 * mobile (dentro de un Sheet). Toda la lógica vive en el padre.
 *
 * Extraído de `EmbarquesFiltros.tsx` (v8.100.1) — antes 254 LOC con responsabilidades
 * mezcladas (campos + sheet + conteo).
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { ESTADOS_EMBARQUE, MODOS_TRANSPORTE } from "@/constants/embarqueConstants";
import SearchInput from "@/components/selects/SearchInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";

interface ClienteOption {
  id: string;
  nombre: string;
}

export interface EmbarquesFiltrosCamposProps {
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
  /** Si true, renderiza inline (desktop). Si false, en columnas con labels (mobile/sheet). */
  layout: "inline" | "stacked";
}

export function EmbarquesFiltrosCampos(props: EmbarquesFiltrosCamposProps) {
  const {
    search, onSearchChange,
    filterModo, filterEstado, filterCliente, filterOperador,
    fechaDesde, fechaHasta,
    onFilterModoChange, onFilterEstadoChange, onFilterClienteChange,
    onFilterOperadorChange,
    onFechaDesdeChange, onFechaHastaChange,
    clientes, operadores, layout,
  } = props;


  const ModoSelect = (
    <Select value={filterModo} onValueChange={onFilterModoChange}>
      <SelectTrigger className="w-full md:w-[160px] md:min-w-[160px]" title="Filtrar por modo de transporte" aria-label="Modo de transporte">
        <SelectValue placeholder="Modo" className="truncate" />
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
  );

  const EstadoSelect = (
    <Select value={filterEstado} onValueChange={onFilterEstadoChange}>
      <SelectTrigger className="w-full md:w-[180px] md:min-w-[180px]" title="Filtrar por estado del embarque" aria-label="Estado del embarque">
        <SelectValue placeholder="Estado" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los estados</SelectItem>
        {ESTADOS_EMBARQUE.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const ClienteSelect = (
    <Select value={filterCliente} onValueChange={onFilterClienteChange}>
      <SelectTrigger className="w-full md:w-[220px] md:min-w-[200px]" title="Filtrar por cliente" aria-label="Cliente">
        <SelectValue placeholder="Cliente" className="truncate" />
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
  );

  const OperadorSelect = (
    <Select value={filterOperador} onValueChange={onFilterOperadorChange}>
      <SelectTrigger className="w-full md:w-[210px] md:min-w-[200px]" title="Filtrar por operador" aria-label="Operador">
        <SelectValue placeholder="Operador" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los operadores</SelectItem>
        {operadores.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
      </SelectContent>
    </Select>
  );



  const FechaDesde = (
    <DatePickerMx
      value={fechaDesde}
      onChange={onFechaDesdeChange}
      className="w-full md:w-[160px]"
      placeholder="Desde (ETD)"
      title="ETD desde"
    />
  );

  const FechaHasta = (
    <DatePickerMx
      value={fechaHasta}
      onChange={onFechaHastaChange}
      className="w-full md:w-[160px]"
      placeholder="Hasta (ETA)"
      title="ETA hasta"
    />
  );

  if (layout === "inline") {
    return (
      <div className="hidden md:flex md:flex-wrap gap-4">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar por expediente, cliente o mercancía..."
          className="flex-1 min-w-[200px]"
        />
        {ModoSelect}
        {EstadoSelect}
        {ClienteSelect}
        {OperadorSelect}
        {ProformaSelect}
        {FechaDesde}
        {FechaHasta}
      </div>
    );
  }

  // stacked (sheet/mobile): no rendereamos el SearchInput aquí; ya está en la barra superior.
  return (
    <div className="space-y-4">
      <FieldGroup label="Modo de transporte">{ModoSelect}</FieldGroup>
      <FieldGroup label="Estado">{EstadoSelect}</FieldGroup>
      <FieldGroup label="Cliente">{ClienteSelect}</FieldGroup>
      <FieldGroup label="Operador">{OperadorSelect}</FieldGroup>
      <FieldGroup label="Proforma">{ProformaSelect}</FieldGroup>
      <FieldGroup label="ETD desde">{FechaDesde}</FieldGroup>
      <FieldGroup label="ETA hasta">{FechaHasta}</FieldGroup>
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
