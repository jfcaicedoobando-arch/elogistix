/**
 * Filtros UI de la tabla de hallazgos de auditoría.
 * Componente puramente presentacional; el estado vive en `useHallazgosTablaState`.
 */
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type {
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/types/auditoria";
import { reglaLabel } from "./hallazgosTablaConfig";
import type { FiltroRevision, FiltroResponsable } from "@/hooks/auditoria/useHallazgosTablaState";

interface Props {
  search: string;
  filtroRegla: ReglaAuditoria | "todas";
  filtroSev: SeveridadAuditoria | "todas";
  filtroCliente: string;
  filtroRevision: FiltroRevision;
  filtroResponsable: FiltroResponsable;
  etaDesde: Date | undefined;
  etaHasta: Date | undefined;
  clientes: string[];
  hayFiltros: boolean;
  filtrados: number;
  total: number;
  setSearch: (v: string) => void;
  setFiltroRegla: (v: ReglaAuditoria | "todas") => void;
  setFiltroSev: (v: SeveridadAuditoria | "todas") => void;
  setFiltroCliente: (v: string) => void;
  setFiltroRevision: (v: FiltroRevision) => void;
  setFiltroResponsable: (v: FiltroResponsable) => void;
  setEtaDesde: (d: Date | undefined) => void;
  setEtaHasta: (d: Date | undefined) => void;
  limpiar: () => void;
}

export function HallazgosFiltros(props: Props) {
  const {
    search, filtroRegla, filtroSev, filtroCliente, filtroRevision, filtroResponsable,
    etaDesde, etaHasta, clientes, hayFiltros, filtrados, total,
    setSearch, setFiltroRegla, setFiltroSev, setFiltroCliente, setFiltroRevision, setFiltroResponsable,
    setEtaDesde, setEtaHasta, limpiar,
  } = props;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-[280px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar expediente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <Select value={filtroRegla} onValueChange={(v) => setFiltroRegla(v as ReglaAuditoria | "todas")}>
        <SelectTrigger className="w-[200px] h-8 text-xs">
          <SelectValue placeholder="Regla" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las reglas</SelectItem>
          {(Object.keys(reglaLabel) as ReglaAuditoria[]).map((r) => (
            <SelectItem key={r} value={r}>
              {reglaLabel[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtroSev} onValueChange={(v) => setFiltroSev(v as SeveridadAuditoria | "todas")}>
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Severidad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Severidad</SelectItem>
          <SelectItem value="critico">Crítico</SelectItem>
          <SelectItem value="alto">Alto</SelectItem>
          <SelectItem value="medio">Medio</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filtroCliente} onValueChange={setFiltroCliente}>
        <SelectTrigger className="w-[200px] h-8 text-xs">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los clientes</SelectItem>
          {clientes.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtroRevision} onValueChange={(v) => setFiltroRevision(v as FiltroRevision)}>
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue placeholder="Revisión" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="pendientes">Pendientes</SelectItem>
          <SelectItem value="en_progreso">En progreso</SelectItem>
          <SelectItem value="revisados">Revisados</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filtroResponsable} onValueChange={(v) => setFiltroResponsable(v as FiltroResponsable)}>
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue placeholder="Responsable" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="mios">Asignados a mí</SelectItem>
          <SelectItem value="sin_asignar">Sin asignar</SelectItem>
          <SelectItem value="vencidos">Vencidos</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 text-xs justify-start font-normal", !etaDesde && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {etaDesde ? format(etaDesde, "dd/MM/yyyy") : "ETA desde"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={etaDesde}
            onSelect={setEtaDesde}
            locale={es}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 text-xs justify-start font-normal", !etaHasta && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {etaHasta ? format(etaHasta, "dd/MM/yyyy") : "ETA hasta"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={etaHasta}
            onSelect={setEtaHasta}
            locale={es}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      {hayFiltros && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limpiar}>
          <X className="h-3.5 w-3.5 mr-1" />
          Limpiar
        </Button>
      )}

      <div className="ml-auto text-xs text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">{filtrados}</span> de {total}
      </div>
    </div>
  );
}
