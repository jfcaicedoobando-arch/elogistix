/**
 * Filtros UI de la tabla de hallazgos de auditoría.
 * - Desktop (md+): fila flex-wrap con todos los selects.
 * - Mobile (<md): search visible + botón "Filtros (N)" abre Sheet.
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileFiltersSheet } from "@/components/shared/MobileFiltersSheet";
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
  const [open, setOpen] = useState(false);

  const activeCount = useMemo(() => {
    let n = 0;
    if (props.filtroRegla !== "todas") n++;
    if (props.filtroSev !== "todas") n++;
    if (props.filtroCliente && props.filtroCliente !== "todos") n++;
    if (props.filtroRevision !== "todos") n++;
    if (props.filtroResponsable !== "todos") n++;
    if (props.etaDesde) n++;
    if (props.etaHasta) n++;
    return n;
  }, [props.filtroRegla, props.filtroSev, props.filtroCliente, props.filtroRevision, props.filtroResponsable, props.etaDesde, props.etaHasta]);

  const SearchField = (
    <div className="relative flex-1 min-w-0 md:min-w-[200px] md:max-w-[280px]">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder="Buscar expediente..."
        value={props.search}
        onChange={(e) => props.setSearch(e.target.value)}
        className="pl-8 h-8 text-xs"
      />
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Mobile */}
      <div className="flex items-center gap-2 md:hidden">
        {SearchField}
        <MobileFiltersSheet
          open={open}
          onOpenChange={setOpen}
          title="Filtros de hallazgos"
          activeCount={activeCount}
          onClearAll={props.limpiar}
        >
          <div className="space-y-3 [&>*]:!w-full [&_button]:!w-full">
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
          </div>
        </MobileFiltersSheet>
        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{props.filtrados}</span>/{props.total}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
        {SearchField}

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
            Limpiar
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{props.filtrados}</span> de {props.total}
        </div>
      </div>
    </div>
  );
}
