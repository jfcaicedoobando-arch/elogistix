import { Download } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { exportToCsv } from "@/generators/exportCsv";
import { useTabProformasController, type FiltroEstadoProforma } from "@/features/facturacion/hooks";
import { buildProformasColumns } from "./proformasColumns";
import ProformasFiltros from "./ProformasFiltros";
import { usePermissions } from "@/hooks/shared";
import { useMemo } from "react";
import { todayLocalISO } from "@/lib/date/today";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { mensajeVacioProformas } from "./proformasEmptyCopy";
import { ProformasEmptyState } from "./proformasEmpty";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ProformaMobileCard } from "./ProformaMobileCard";
import { LABEL_ESTADO_UNIFICADO } from "@/lib/domain/estadoUnificado";
import { useProformasListadoTable } from "@/features/facturacion/hooks/useProformasListadoTable";
import { ProformasFusionToolbar } from "./ProformasFusionToolbar";

export function TabProformas({ isInRange, estadoInicial }: {
  isInRange?: (fecha: string | null | undefined) => boolean;
  estadoInicial?: FiltroEstadoProforma;
}) {
  const c = useTabProformasController({ isInRange, estadoInicial });
  const { canEmitirFactura } = usePermissions();

  // v13.823.278 — quien no puede emitir facturas (vendedor, gerente comercial)
  // ya no ve la casilla de selección: antes podía seleccionar y quedaba con el
  // botón "Fusionar/Convertir" deshabilitado sin explicación. El guard del
  // backend no cambia.
  const columns = useMemo(
    () => buildProformasColumns(
      canEmitirFactura
        ? {
            selection: {
              selectedIds: c.selectedIds,
              toggle: c.toggleSelected,
              isSelectable: c.isConvertible,
            },
          }
        : {},
    ),
    [canEmitirFactura, c.selectedIds, c.toggleSelected, c.isConvertible],
  );
  const listado = useProformasListadoTable({
    data: c.filtered, columns, page: c.page, pageSize: c.pageSize, onPageChange: c.setPage,
  });

  return (
    <CargaGuard
      isLoading={c.isLoading}
      isError={c.isError}
      onRetry={c.refetch}
      errorTitle="No se pudieron cargar las proformas"
      errorDescription="Ocurrió un error al obtener el listado de proformas. Intenta de nuevo."
    >
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-0">
          <div className="flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-[240px]">
              <ProformasFiltros
                search={c.search}
                onSearchChange={c.setSearch}
                filtroEstado={c.filtroEstado}
                onFiltroEstadoChange={(v) => c.setFiltroEstado(v as typeof c.filtroEstado)}
                filtroCliente={c.filtroCliente}
                onFiltroClienteChange={c.setFiltroCliente}
                filtroOperador={c.filtroOperador}
                onFiltroOperadorChange={c.setFiltroOperador}
                fechaDesde={c.fechaDesde}
                onFechaDesdeChange={c.setFechaDesde}
                fechaHasta={c.fechaHasta}
                onFechaHastaChange={c.setFechaHasta}
                clientes={c.clientesDisponibles}
                operadores={c.operadoresDisponibles}
                onClearAll={c.clearFiltros}
              />
            </div>
            <Button
              variant="outline"
              disabled={c.filtered.length === 0}
              onClick={() => exportToCsv(
                `proformas_${todayLocalISO()}.csv`,
                c.csvColumns,
                c.csvRows(),
              )}
            >
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>
          <div className="mt-3 text-body-sm text-muted-foreground">
            Mostrando <strong className="text-foreground">{c.filtered.length}</strong> de{" "}
            {c.filtroEstado === "todas" ? c.counts.todas : c.counts[c.filtroEstado]} proformas
            {/* R170-01: el resumen usa la etiqueta visible del grupo (p. ej.
                "Convertida"), no la clave interna ("facturada"), que prometía
                emisión fiscal inexistente. Claves y filtros no cambian. */}
            {c.filtroEstado !== "todas" && (
              <> con estado {LABEL_ESTADO_UNIFICADO[c.filtroEstado]}</>
            )}
          </div>


        </CardContent>
      </Card>


      {canEmitirFactura && c.selectedProformas.length > 0 && (
        <ProformasFusionToolbar selection={{
          selectedProformas: c.selectedProformas, fusionInfo: c.fusionInfo, clearSelected: c.clearSelected,
        }} />
      )}

      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            key={c.filtroEstado}
            columns={columns}
            data={listado.data}
            sortMode="server"
            controlledSort={listado.controlledSort}
            onSortChange={listado.onSortChange}
            isLoading={c.isLoading}
            emptyMessage={mensajeVacioProformas(c.search, c.filtroEstado)}
            emptyState={
              c.counts.todas > 0 && c.filtered.length === 0 ? (
                <ProformasEmptyState
                  search={c.search}
                  filtroEstado={c.filtroEstado}
                  onLimpiarBusqueda={() => c.setSearch("")}
                  onLimpiarFiltros={c.clearFiltros}
                />
              ) : undefined
            }
            rowKey={(p) => p.id}
            density={TABLE_DENSITY.listado}
            getRowHref={(p) => `/proformas/${p.id}`}
            pagination={{
              page: c.page,
              totalPages: c.totalPages,
              onPageChange: c.setPage,
              pageSize: c.pageSize,
              onPageSizeChange: (s) => { c.setPageSize(s); c.setPage(0); },
              pageSizeOptions: [50, 100, 200, 500],
              pageSizeLabels: { 500: "500" },
              total: c.filtered.length,
              hideWhenSinglePage: true,
            }}
            mobileCard={(p) => <ProformaMobileCard proforma={p} />}
          />
        </CardContent>
      </Card>
    </div>
    </CargaGuard>
  );
}
