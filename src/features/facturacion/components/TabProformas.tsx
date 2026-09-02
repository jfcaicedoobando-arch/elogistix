import { Download, Receipt, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { exportToCsv } from "@/generators/exportCsv";
import { useTabProformasController, type FiltroEstadoProforma } from "@/features/facturacion/hooks";
import { buildProformasColumns } from "./proformasColumns";
import ProformasFiltros from "./ProformasFiltros";
import { useConvertirProformaDirecto } from "@/features/proformas/hooks/useConvertirProformaDirecto";
import { usePermissions } from "@/hooks/shared";
import { useMemo } from "react";
import { todayLocalISO } from "@/lib/date/today";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { mensajeVacioProformas } from "./proformasEmptyCopy";
import { ProformasEmptyState } from "./proformasEmpty";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ProformaMobileCard } from "./ProformaMobileCard";


export function TabProformas({ isInRange, estadoInicial }: {
  isInRange?: (fecha: string | null | undefined) => boolean;
  estadoInicial?: FiltroEstadoProforma;
}) {
  const c = useTabProformasController({ isInRange, estadoInicial });
  const { canEmitirFactura } = usePermissions();
  const { convertir, isPending: convirtiendo } = useConvertirProformaDirecto();

  const columns = useMemo(
    () => buildProformasColumns({
      selection: {
        selectedIds: c.selectedIds,
        toggle: c.toggleSelected,
        isSelectable: c.isConvertible,
      },
    }),
    [c.selectedIds, c.toggleSelected, c.isConvertible],
  );

  const seleccionados = c.selectedProformas.length;
  const puedeFusionar = seleccionados > 0 && c.fusionInfo.sameCliente && canEmitirFactura;

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
            Mostrando <strong className="text-foreground">{c.filtered.length}</strong> de {c.counts.todas} proformas
          </div>
        </CardContent>
      </Card>


      {seleccionados > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <div className="text-body flex-1 min-w-[240px]">
              <strong>{seleccionados}</strong> proforma{seleccionados === 1 ? "" : "s"} seleccionada{seleccionados === 1 ? "" : "s"}
              {c.fusionInfo.clienteNombre && <> · {c.fusionInfo.clienteNombre}</>}
            </div>
            {!c.fusionInfo.sameCliente && (
              <Alert variant="destructive" className="py-2 px-3 m-0 w-full md:w-auto">
                <AlertDescription className="text-body-sm">
                  Sólo puedes fusionar proformas del mismo cliente.
                </AlertDescription>
              </Alert>
            )}
            <Button variant="ghost" size="sm" onClick={c.clearSelected}>
              <X className="h-4 w-4 mr-1" /> Limpiar
            </Button>
            <Button
              size="sm"
              disabled={!puedeFusionar || convirtiendo}
              loading={convirtiendo}
              onClick={() => {
                if (!c.fusionInfo.organizationId) return;
                convertir(
                  {
                    proformaIds: c.selectedProformas.map((p) => p.id),
                    organizationId: c.fusionInfo.organizationId,
                    diasCredito: c.fusionInfo.diasCredito,
                  },
                  { onSuccess: () => c.clearSelected() },
                );
              }}
            >
              {!convirtiendo && <Receipt className="h-4 w-4 mr-1" />}
              {seleccionados === 1 ? "Convertir a factura" : `Fusionar ${seleccionados} en una factura`}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            key={c.filtroEstado}
            columns={columns}
            data={c.paginated}
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
            }}
            mobileCard={(p) => <ProformaMobileCard proforma={p} />}
          />
        </CardContent>
      </Card>
    </div>
    </CargaGuard>
  );
}
