import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getModoIcon } from "@/lib/ui/uiMappings";
import { ESTADOS_EMBARQUE, MODOS_TRANSPORTE } from "@/constants/embarqueConstants";
import SearchInput from "@/components/selects/SearchInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";

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
  filterProforma: string;
  onFilterProformaChange: (v: string) => void;
  fechaDesde: string;
  onFechaDesdeChange: (v: string) => void;
  fechaHasta: string;
  onFechaHastaChange: (v: string) => void;
  clientes: ClienteOption[];
  operadores: string[];
}

export default function EmbarquesFiltros({
  search, onSearchChange,
  filterModo, onFilterModoChange,
  filterEstado, onFilterEstadoChange,
  filterCliente, onFilterClienteChange,
  filterOperador, onFilterOperadorChange,
  filterProforma, onFilterProformaChange,
  fechaDesde, onFechaDesdeChange,
  fechaHasta, onFechaHastaChange,
  clientes, operadores,
}: Props) {
  return (
    <div className="flex flex-wrap gap-4">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Buscar por expediente, cliente o mercancía..."
        className="flex-1 min-w-[200px]"
      />
      <Select value={filterModo} onValueChange={onFilterModoChange}>
        <SelectTrigger className="w-[150px] min-w-[140px]"><SelectValue placeholder="Modo" className="truncate" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los modos</SelectItem>
          {MODOS_TRANSPORTE.map(m => <SelectItem key={m} value={m}>{getModoIcon(m)} {m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterEstado} onValueChange={onFilterEstadoChange}>
        <SelectTrigger className="w-[170px] min-w-[160px]"><SelectValue placeholder="Estado" className="truncate" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {ESTADOS_EMBARQUE.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterCliente} onValueChange={onFilterClienteChange}>
        <SelectTrigger className="w-[220px] min-w-[180px]"><SelectValue placeholder="Cliente" className="truncate" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los clientes</SelectItem>
          {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre.split(' ').slice(0, 3).join(' ')}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterOperador} onValueChange={onFilterOperadorChange}>
        <SelectTrigger className="w-[200px] min-w-[180px]"><SelectValue placeholder="Operador" className="truncate" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los operadores</SelectItem>
          {operadores.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterProforma} onValueChange={onFilterProformaChange}>
        <SelectTrigger className="w-[180px] min-w-[160px]"><SelectValue placeholder="Proforma" className="truncate" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas las proformas</SelectItem>
          <SelectItem value="con">Con proforma</SelectItem>
          <SelectItem value="sin">Sin proforma</SelectItem>
        </SelectContent>
      </Select>
      <DatePickerMx value={fechaDesde} onChange={onFechaDesdeChange} className="w-[160px]" placeholder="Desde (ETD)" title="ETD desde" />
      <DatePickerMx value={fechaHasta} onChange={onFechaHastaChange} className="w-[160px]" placeholder="Hasta (ETA)" title="ETA hasta" />
    </div>
  );
}
