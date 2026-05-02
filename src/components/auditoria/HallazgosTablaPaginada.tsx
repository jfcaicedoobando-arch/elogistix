/**
 * Tabla paginada de hallazgos de auditoría — ensamblador delgado.
 * Composición: Filtros + Tabla + Paginación + Diálogo de revisión.
 * El estado vive en `useHallazgosTablaState`.
 */
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { revisionKey } from "@/hooks/auditoria/useAuditoriaRevisiones";
import { useHallazgosTablaState, type UseHallazgosTablaStateOptions } from "@/hooks/auditoria/useHallazgosTablaState";
import { MarcarRevisadoDialog } from "@/components/auditoria/MarcarRevisadoDialog";
import { AsignarResponsableDialog } from "@/components/auditoria/AsignarResponsableDialog";
import { HallazgosFiltros } from "./HallazgosFiltros";
import { HallazgosTabla } from "./HallazgosTabla";
import { HallazgosPagination } from "./HallazgosPagination";
import type { HallazgoAuditoria } from "@/types/auditoria";

interface Props {
  hallazgos: HallazgoAuditoria[];
  /** Si es true, default = "todos"; si es false (default), default = "pendientes". */
  mostrarRevisadosDefault?: boolean;
  /** Filtros iniciales (drill-down desde la vista ejecutiva). */
  initialFilters?: UseHallazgosTablaStateOptions;
}

export function HallazgosTablaPaginada({
  hallazgos,
  mostrarRevisadosDefault = false,
  initialFilters,
}: Props) {
  const { user } = useAuth();
  const state = useHallazgosTablaState(hallazgos, mostrarRevisadosDefault, initialFilters);
  const [dialogHallazgo, setDialogHallazgo] = useState<HallazgoAuditoria | null>(null);
  const [asignarHallazgo, setAsignarHallazgo] = useState<HallazgoAuditoria | null>(null);

  return (
    <div className="space-y-3">
      <HallazgosFiltros
        search={state.search}
        filtroRegla={state.filtroRegla}
        filtroSev={state.filtroSev}
        filtroCliente={state.filtroCliente}
        filtroRevision={state.filtroRevision}
        filtroResponsable={state.filtroResponsable}
        etaDesde={state.etaDesde}
        etaHasta={state.etaHasta}
        clientes={state.clientes}
        hayFiltros={state.hayFiltros}
        filtrados={state.filtrados.length}
        total={state.totalHallazgos}
        setSearch={state.setSearch}
        setFiltroRegla={state.setFiltroRegla}
        setFiltroSev={state.setFiltroSev}
        setFiltroCliente={state.setFiltroCliente}
        setFiltroRevision={state.setFiltroRevision}
        setFiltroResponsable={state.setFiltroResponsable}
        setEtaDesde={state.setEtaDesde}
        setEtaHasta={state.setEtaHasta}
        limpiar={state.limpiar}
      />

      <HallazgosTabla
        visibles={state.visibles}
        start={state.start}
        revisiones={state.revisiones}
        currentUserId={user?.id ?? null}
        onMarcarRevisado={setDialogHallazgo}
        onAsignarResponsable={setAsignarHallazgo}
      />

      <MarcarRevisadoDialog
        hallazgo={dialogHallazgo}
        revisionExistente={
          dialogHallazgo ? state.revisiones?.get(revisionKey(dialogHallazgo)) ?? null : null
        }
        open={!!dialogHallazgo}
        onOpenChange={(o) => {
          if (!o) setDialogHallazgo(null);
        }}
      />

      <AsignarResponsableDialog
        hallazgo={asignarHallazgo}
        revisionExistente={
          asignarHallazgo ? state.revisiones?.get(revisionKey(asignarHallazgo)) ?? null : null
        }
        open={!!asignarHallazgo}
        onOpenChange={(o) => {
          if (!o) setAsignarHallazgo(null);
        }}
      />

      <HallazgosPagination
        pageSize={state.pageSize}
        currentPage={state.currentPage}
        totalPages={state.totalPages}
        start={state.start}
        total={state.filtrados.length}
        onPageSizeChange={state.setPageSize}
        onPageChange={state.setPage}
      />
    </div>
  );
}
