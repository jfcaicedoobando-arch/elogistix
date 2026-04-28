import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModoIcon } from "@/components/shared/ModoIcon";
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

/**
 * v8.99.41 — Filtros responsive con Sheet en mobile.
 *
 * En `md+`: render inline tradicional (search + 6 selects + 2 fechas en una fila).
 * En `<md`: solo SearchInput + botón "Filtros (N)" que abre un Sheet lateral con todos
 * los selects y fechas, evitando que la barra de filtros ocupe ~600px de scroll antes
 * del contenido (problema reportado en auditoría visual).
 *
 * El badge "(N)" muestra el número de filtros activos (excluyendo búsqueda) y permite
 * limpiarlos todos de un solo click desde el footer del Sheet.
 */
export default function EmbarquesFiltros(props: Props) {
  const {
    search, onSearchChange,
    filterModo, filterEstado, filterCliente, filterOperador, filterProforma,
    fechaDesde, fechaHasta,
    onFilterModoChange, onFilterEstadoChange, onFilterClienteChange,
    onFilterOperadorChange, onFilterProformaChange,
    onFechaDesdeChange, onFechaHastaChange,
    clientes, operadores,
  } = props;

  const [sheetOpen, setSheetOpen] = useState(false);

  // Conteo de filtros activos (excluye búsqueda libre, que ya tiene su propio input visible).
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterModo && filterModo !== "todos") n++;
    if (filterEstado && filterEstado !== "todos") n++;
    if (filterCliente && filterCliente !== "todos") n++;
    if (filterOperador && filterOperador !== "todos") n++;
    if (filterProforma && filterProforma !== "todos") n++;
    if (fechaDesde) n++;
    if (fechaHasta) n++;
    return n;
  }, [filterModo, filterEstado, filterCliente, filterOperador, filterProforma, fechaDesde, fechaHasta]);

  const clearAll = () => {
    onFilterModoChange("todos");
    onFilterEstadoChange("todos");
    onFilterClienteChange("todos");
    onFilterOperadorChange("todos");
    onFilterProformaChange("todos");
    onFechaDesdeChange("");
    onFechaHastaChange("");
  };

  // Selects extraídos a componentes locales para reusarlos en desktop e inside-sheet.
  const ModoSelect = (
    <Select value={filterModo} onValueChange={onFilterModoChange}>
      <SelectTrigger className="w-full md:w-[150px] md:min-w-[140px]">
        <SelectValue placeholder="Modo" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los modos</SelectItem>
        {MODOS_TRANSPORTE.map(m => (
          <SelectItem key={m} value={m}>
            <span className="inline-flex items-center gap-2"><ModoIcon modo={m} size={14} /> {m}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const EstadoSelect = (
    <Select value={filterEstado} onValueChange={onFilterEstadoChange}>
      <SelectTrigger className="w-full md:w-[170px] md:min-w-[160px]">
        <SelectValue placeholder="Estado" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los estados</SelectItem>
        {ESTADOS_EMBARQUE.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const ClienteSelect = (
    <Select value={filterCliente} onValueChange={onFilterClienteChange}>
      <SelectTrigger className="w-full md:w-[220px] md:min-w-[180px]">
        <SelectValue placeholder="Cliente" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los clientes</SelectItem>
        {clientes.map(c => (
          <SelectItem key={c.id} value={c.id}>{c.nombre.split(' ').slice(0, 3).join(' ')}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const OperadorSelect = (
    <Select value={filterOperador} onValueChange={onFilterOperadorChange}>
      <SelectTrigger className="w-full md:w-[200px] md:min-w-[180px]">
        <SelectValue placeholder="Operador" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los operadores</SelectItem>
        {operadores.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const ProformaSelect = (
    <Select value={filterProforma} onValueChange={onFilterProformaChange}>
      <SelectTrigger className="w-full md:w-[180px] md:min-w-[160px]">
        <SelectValue placeholder="Proforma" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todas las proformas</SelectItem>
        <SelectItem value="con">Con proforma</SelectItem>
        <SelectItem value="sin">Sin proforma</SelectItem>
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

  return (
    <>
      {/* Mobile: search + botón "Filtros (N)" */}
      <div className="flex gap-2 md:hidden">
        <SearchInput
          value={search}
          onChange={onSearchChange}
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <FieldGroup label="Modo de transporte">{ModoSelect}</FieldGroup>
              <FieldGroup label="Estado">{EstadoSelect}</FieldGroup>
              <FieldGroup label="Cliente">{ClienteSelect}</FieldGroup>
              <FieldGroup label="Operador">{OperadorSelect}</FieldGroup>
              <FieldGroup label="Proforma">{ProformaSelect}</FieldGroup>
              <FieldGroup label="ETD desde">{FechaDesde}</FieldGroup>
              <FieldGroup label="ETA hasta">{FechaHasta}</FieldGroup>
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
              <Button onClick={() => setSheetOpen(false)}>
                Aplicar
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop md+: layout inline original */}
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
    </>
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
