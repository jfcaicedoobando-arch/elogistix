/**
 * Filtros UI de la tabla de hallazgos de auditoría.
 * Componente puramente presentacional; el estado vive en `useHallazgosTablaState`.
 * Los grupos visuales (selects y rango de fechas) viven en `./HallazgosFiltros.parts`.
 */
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReglaAuditoria, SeveridadAuditoria } from "@/features/auditoria/types";
import type { FiltroRevision, FiltroResponsable } from "@/features/auditoria/hooks";
import {
  HallazgosFiltrosSelects,
  HallazgosFiltrosFechas,
} from "./HallazgosFiltros.parts";

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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-[280px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar expediente..."
          value={props.search}
          onChange={(e) => props.setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <HallazgosFiltrosSelects
        filtroRegla={props.filtroRegla}
        filtroSev={props.filtroSev}
        filtroCliente={props.filtroCliente}
        filtroRevision={props.filtroRevision}
        filtroResponsable={props.filtroResponsable}
        clientes={props.clientes}
        setFiltroRegla={props.setFiltroRegla}
        setFiltroSev={props.setFiltroSev}
        setFiltroCliente={props.setFiltroCliente}
        setFiltroRevision={props.setFiltroRevision}
        setFiltroResponsable={props.setFiltroResponsable}
      />

      <HallazgosFiltrosFechas
        etaDesde={props.etaDesde}
        etaHasta={props.etaHasta}
        setEtaDesde={props.setEtaDesde}
        setEtaHasta={props.setEtaHasta}
      />

      {props.hayFiltros && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={props.limpiar}>
          <X className="h-3.5 w-3.5 mr-1" />
          Limpiar
        </Button>
      )}

      <div className="ml-auto text-xs text-muted-foreground tabular-nums">
        <span className="font-semibold text-foreground">{props.filtrados}</span> de {props.total}
      </div>
    </div>
  );
}
