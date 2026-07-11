/**
 * Sub-componentes de `HallazgosFiltros` extraídos para mantener el archivo
 * principal ≤200 LOC (Power of 10).
 */
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { ReglaAuditoria, SeveridadAuditoria } from "@/features/auditoria/types";
import type { FiltroRevision, FiltroResponsable } from "@/features/auditoria/hooks";
import { reglaLabel } from "./hallazgosTablaConfig";
import {
  filtroResponsableSchema, filtroRevisionSchema,
  reglaAuditoriaFiltroSchema, severidadFiltroSchema,
} from "./hallazgosFiltrosSchemas";

interface SelectsProps {
  filtroRegla: ReglaAuditoria | "todas";
  filtroSev: SeveridadAuditoria | "todas";
  filtroCliente: string;
  filtroRevision: FiltroRevision;
  filtroResponsable: FiltroResponsable;
  clientes: string[];
  setFiltroRegla: (v: ReglaAuditoria | "todas") => void;
  setFiltroSev: (v: SeveridadAuditoria | "todas") => void;
  setFiltroCliente: (v: string) => void;
  setFiltroRevision: (v: FiltroRevision) => void;
  setFiltroResponsable: (v: FiltroResponsable) => void;
}

export function HallazgosFiltrosSelects(p: SelectsProps) {
  return (
    <>
      <Select value={p.filtroRegla} onValueChange={(v) => p.setFiltroRegla(reglaAuditoriaFiltroSchema.parse(v))}>
        <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Regla" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas las reglas</SelectItem>
          {(Object.keys(reglaLabel) as ReglaAuditoria[]).map((r) => (
            <SelectItem key={r} value={r}>{reglaLabel[r]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={p.filtroSev} onValueChange={(v) => p.setFiltroSev(severidadFiltroSchema.parse(v))}>
        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Severidad" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Severidad</SelectItem>
          <SelectItem value="critico">Crítico</SelectItem>
          <SelectItem value="alto">Alto</SelectItem>
          <SelectItem value="medio">Medio</SelectItem>
        </SelectContent>
      </Select>

      <Select value={p.filtroCliente} onValueChange={p.setFiltroCliente}>
        <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los clientes</SelectItem>
          {p.clientes.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={p.filtroRevision} onValueChange={(v) => p.setFiltroRevision(filtroRevisionSchema.parse(v))}>
        <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Revisión" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="pendientes">Pendientes</SelectItem>
          <SelectItem value="en_progreso">En progreso</SelectItem>
          <SelectItem value="revisados">Revisados</SelectItem>
        </SelectContent>
      </Select>

      <Select value={p.filtroResponsable} onValueChange={(v) => p.setFiltroResponsable(filtroResponsableSchema.parse(v))}>
        <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Responsable" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="mios">Asignados a mí</SelectItem>
          <SelectItem value="sin_asignar">Sin asignar</SelectItem>
          <SelectItem value="vencidos">Vencidos</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

interface DateRangeProps {
  etaDesde: Date | undefined;
  etaHasta: Date | undefined;
  setEtaDesde: (d: Date | undefined) => void;
  setEtaHasta: (d: Date | undefined) => void;
}

export function HallazgosFiltrosFechas({ etaDesde, etaHasta, setEtaDesde, setEtaHasta }: DateRangeProps) {
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm"
            className={cn("h-8 text-xs justify-start font-normal", !etaDesde && "text-muted-foreground")}>
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {etaDesde ? format(etaDesde, "dd/MM/yyyy") : "ETA desde"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={etaDesde} onSelect={setEtaDesde} locale={es}
            autoFocus className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm"
            className={cn("h-8 text-xs justify-start font-normal", !etaHasta && "text-muted-foreground")}>
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {etaHasta ? format(etaHasta, "dd/MM/yyyy") : "ETA hasta"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={etaHasta} onSelect={setEtaHasta} locale={es}
            autoFocus className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>
    </>
  );
}
