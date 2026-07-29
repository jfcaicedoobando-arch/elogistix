import { useCallback, useMemo } from "react";
import { Plus, FileText, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnVisibilityMenu } from "@/components/shared/ColumnVisibilityMenu";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { CxpRouteDialogs } from "@/features/cxp/routes/_sections/CxpRouteDialogs";
import { usePermissions, useColumnVisibility } from "@/hooks/shared";
import {
  useFacturasCxP,
  useEliminarFacturaProveedor,
  useCxpPageState,
  useCxpDeepLinks,
} from "@/features/cxp/hooks";
import { buildCxPColumns } from "@/features/cxp/components/cxpColumns";
import { CxpFiltros } from "@/features/cxp/components/CxpFiltros";
import { CxpKpiCards } from "@/features/cxp/components/CxpKpiCards";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CXP_COL_DEFAULTS, CXP_COL_OPTIONS } from "@/features/cxp/routes/_config/cxpColumnConfig";

// P18: `useCobranza({})` sale del cuerpo — se resuelve on-demand con queryClient.fetchQuery.
import { fetchCobranza } from "@/features/facturacion/services";
import { queryKeys } from "@/lib/query";
import { descargarPdf } from "@/pdf/render/descargarPdf";
// P12: ReporteCarteraDocument se carga dinámicamente en el handler.
import type { FacturaCxP } from "@/features/cxp/services";
import { notifyError } from "@/lib/ui/appFeedback";
import { withOrgPrefix } from "@/lib/filenames";
import { todayLocalISO } from "@/lib/date/today";
import { exportarCxpCsv } from "@/features/cxp/routes/_helpers/exportarCxpCsv";
import { CxpEmptyState } from "@/features/cxp/components/CxpEmptyState";

export default function Cxp() {
  const { canEdit } = usePermissions();
  const f = useCxpPageState();
  const queryClient = useQueryClient();

  const { data = [], isLoading, isError, refetch, kpis } = useFacturasCxP(f.queryArgs);
  const eliminar = useEliminarFacturaProveedor();

  useCxpDeepLinks({ data, isLoading, onOpenDetalle: f.setDetalle });

  const handlePdf = async () => {
    const fecha = todayLocalISO();
    // P18: Se pide la cartera CxC solo al presionar el botón (fetchQuery cachea con la misma queryKey).
    const cobranzaKey = queryKeys.facturas.cobranza({});
    const cxc = await queryClient.fetchQuery({
      queryKey: cobranzaKey,
      queryFn: () => fetchCobranza({}),
      staleTime: 30_000,
    });
    // P12: import dinámico del Document — solo entra al bundle si el usuario descarga.
    const { ReporteCarteraDocument } = await import("@/pdf/documents/ReporteCarteraDocument");
    await descargarPdf(
      <ReporteCarteraDocument fechaCorte={fecha} cxc={cxc} cxp={data} />,
      await withOrgPrefix(`Reporte_Cartera_${fecha}.pdf`),
    );
  };

  const onEliminar = useCallback((fact: FacturaCxP) => {
    if (fact.pagado > 0) {
      notifyError(undefined, { title: "No se puede eliminar: la factura tiene pagos registrados", method: "PAGES_CXP_CXP_1" });
      return;
    }
    f.setAEliminar(fact);
  }, [f]);

  const columns = useMemo(() => buildCxPColumns(), []);
  const colVis = useColumnVisibility("cxp-facturas-columns", CXP_COL_DEFAULTS);

  const totalPages = Math.max(1, Math.ceil(data.length / f.pageSize));
  const pageData = useMemo(
    () => data.slice(f.page * f.pageSize, (f.page + 1) * f.pageSize),
    [data, f.page, f.pageSize],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Facturas de proveedor"
        description="Cuentas por Pagar — facturas recibidas y su saldo pendiente"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportarCxpCsv(data)} disabled={data.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
            <Button variant="outline" onClick={handlePdf}>
              <FileText className="h-4 w-4 mr-2" /> Reporte PDF
            </Button>
            {canEdit && (
              <Button onClick={() => f.setOpenNueva(true)}>
                <Plus className="h-4 w-4 mr-2" /> Capturar factura
              </Button>
            )}
          </div>
        }
      />

      <CxpKpiCards kpis={kpis} data={data} />

      <Card>
        <CardContent className="p-4 space-y-3">
          <CxpFiltros
            search={f.search} onSearchChange={f.setSearch}
            estatus={f.estatus} onEstatusChange={f.setEstatus}
            moneda={f.moneda} onMonedaChange={f.setMoneda}
            origen={f.origen} onOrigenChange={f.setOrigen}
            aprobacion={f.aprobacion} onAprobacionChange={f.setAprobacion}
            proveedorId={f.proveedorId} onProveedorChange={f.setProveedorId}
            categoriaPresupuestoId={f.categoriaPresupuestoId} onCategoriaPresupuestoChange={f.setCategoriaPresupuestoId}
            fechaDesde={f.fechaDesde} onFechaDesdeChange={f.setFechaDesde}
            fechaHasta={f.fechaHasta} onFechaHastaChange={f.setFechaHasta}
          />
          <div className="flex justify-end">
            <ColumnVisibilityMenu
              options={CXP_COL_OPTIONS}
              visibility={colVis.visibility}
              onToggle={colVis.toggle}
              onReset={colVis.reset}
              isCustom={colVis.isCustom}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!isLoading && data.length === 0 && !f.hayFiltros ? (
            <CxpEmptyState canEdit={canEdit} onCapturar={() => f.setOpenNueva(true)} />
          ) : (
            <TooltipProvider delayDuration={200}>
              <DataTable
                columns={columns}
                data={pageData}
                isLoading={isLoading}
                isError={isError}
                onRetry={() => refetch()}
                emptyMessage="No hay facturas que coincidan con los filtros"
                rowKey={(f) => f.id}
                density="compact"
                initialSort={{ key: "folio_interno", dir: "desc" }}
                onRowClick={(fact) => f.setDetalle(fact)}
                stickyHeader
                columnVisibility={colVis.visibility}
                onColumnVisibilityChange={(updater) => {
                  const next = typeof updater === "function" ? updater(colVis.visibility) : updater;
                  colVis.setVisibility(next);
                }}
                pagination={{
                  page: f.page,
                  totalPages,
                  onPageChange: f.setPage,
                  pageSize: f.pageSize,
                }}
              />
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      <CxpRouteDialogs
        f={f}
        data={data}
        canEdit={canEdit}
        isPendingEliminar={eliminar.isPending}
        onEliminar={onEliminar}
        onConfirmEliminar={async () => {
          if (!f.aEliminar) return;
          try { await eliminar.mutateAsync(f.aEliminar.id); } catch { /* hook notifica */ }
          f.setAEliminar(null);
        }}
      />
    </PageContainer>
  );
}
