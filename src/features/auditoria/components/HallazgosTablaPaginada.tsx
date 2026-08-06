/**
 * Tabla paginada de hallazgos de auditoría — ensamblador delgado.
 * Composición: Filtros + Tabla + Paginación + Diálogo de revisión.
 * El estado vive en `useHallazgosTablaState`.
 */
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/contexts/AuthContext";
import { revisionKey } from "@/features/auditoria/hooks";
import { useHallazgosTablaState, type UseHallazgosTablaStateOptions } from "@/features/auditoria/hooks";
import { MarcarRevisadoDialog } from "@/features/auditoria/components/MarcarRevisadoDialog";
import { AsignarResponsableDialog } from "@/features/auditoria/components/AsignarResponsableDialog";
import { MarcarRevisadosBulkDialog } from "@/features/auditoria/components/MarcarRevisadosBulkDialog";
import { HallazgosBulkBar } from "@/features/auditoria/components/HallazgosBulkBar";
import { HallazgosFiltros } from "./HallazgosFiltros";
import { HallazgosTabla } from "./HallazgosTabla";
import PaginationControls from "@/components/shared/PaginationControls";
import { PAGE_SIZE_OPTIONS } from "./hallazgosTablaConfig";
import type { HallazgoAuditoria } from "@/features/auditoria/types";

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
  const [bulkOpen, setBulkOpen] = useState(false);

  const hallazgosSeleccionados = useMemo(
    () => state.visibles.filter((h) => state.selectedIds.has(revisionKey(h))),
    [state.visibles, state.selectedIds],
  );

  return (
    <div className="space-y-3">
      {state.soloEtaVencida && (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="gap-1.5">
            ETA vencida
            <button
              type="button"
              aria-label="Quitar filtro de ETA vencida"
              onClick={() => state.setSoloEtaVencida(false)}
              className="rounded-sm opacity-80 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
          <span className="text-xs text-muted-foreground">
            Mostrando sólo hallazgos pendientes de embarques cuyo ETA ya pasó.
          </span>
        </div>
      )}
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

      <HallazgosBulkBar
        count={state.selectedIds.size}
        onMarcar={() => setBulkOpen(true)}
        onLimpiar={state.clearSelection}
      />

      <HallazgosTabla
        visibles={state.visibles}
        start={state.start}
        revisiones={state.revisiones}
        currentUserId={user?.id ?? null}
        onMarcarRevisado={setDialogHallazgo}
        onAsignarResponsable={setAsignarHallazgo}
        selectedIds={state.selectedIds}
        selectablesEnPagina={state.selectablesEnPagina}
        onToggleSelected={state.toggleSelected}
        onToggleAllVisible={state.toggleAllVisible}
      />

      <MarcarRevisadosBulkDialog
        open={bulkOpen}
        hallazgos={hallazgosSeleccionados}
        onOpenChange={setBulkOpen}
        onSuccess={state.clearSelection}
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

      {/* Paginación estándar del ERP (base 0); el estado local es base 1. */}
      <PaginationControls
        page={state.currentPage - 1}
        totalPages={state.totalPages}
        onPageChange={(p) => state.setPage(p + 1)}
        pageSize={state.pageSize}
        onPageSizeChange={state.setPageSize}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        total={state.filtrados.length}
      />
    </div>
  );
}
