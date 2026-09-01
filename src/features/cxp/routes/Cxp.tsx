import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { ColumnVisibilityMenu } from "@/components/shared/ColumnVisibilityMenu";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { CxpRouteDialogs } from "@/features/cxp/routes/_sections/CxpRouteDialogs";
import { usePermissions, useColumnVisibility, useDocumentTitle } from "@/hooks/shared";
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

import type { FacturaCxP } from "@/features/cxp/services";
import { ROUTES } from "@/constants/routes";
import { exportarCxpCsv } from "@/features/cxp/routes/_helpers/exportarCxpCsv";
import { CxpEmptyState } from "@/features/cxp/components/CxpEmptyState";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { EstadoFacturaCxPCell } from "@/features/cxp/components/EstadoFacturaCxPCell";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatDate, toTitleCase, formatCurrency } from "@/lib/formatters";

export default function Cxp() {
  useDocumentTitle("Facturas de proveedor");
  const { canCapturarFacturaProveedor } = usePermissions();
  const f = useCxpPageState();
  const navigate = useNavigate();
  const abrirDetalle = useCallback(
    (fact: FacturaCxP) => navigate(`/compras/facturas/${fact.id}`),
    [navigate],
  );

  const { data = [], isLoading, isError, refetch, kpis } = useFacturasCxP(f.queryArgs);
  const eliminar = useEliminarFacturaProveedor();

  useCxpDeepLinks({ data, isLoading, onOpenDetalle: abrirDetalle });

  const columns = useMemo(() => buildCxPColumns(), []);
  const colVis = useColumnVisibility("cxp-facturas-columns", CXP_COL_DEFAULTS);

  const totalPages = Math.max(1, Math.ceil(data.length / f.pageSize));
  // Una página fuera de rango (deep link viejo, o menos resultados tras
  // filtrar) mostraba una tabla vacía aunque hubiera coincidencias.
  const pageActual = Math.min(f.page, totalPages - 1);
  const pageData = useMemo(
    () => data.slice(pageActual * f.pageSize, (pageActual + 1) * f.pageSize),
    [data, pageActual, f.pageSize],
  );

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Facturas de proveedor"
        description="Cuentas por Pagar — facturas recibidas y su saldo pendiente"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportarCxpCsv(data)} disabled={data.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
            <Button variant="outline" onClick={() => navigate(ROUTES.REPORTES_CARTERA)}>
              <FileText className="h-4 w-4 mr-2" /> Cartera y antigüedad
            </Button>
            {canCapturarFacturaProveedor && (
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
            <CxpEmptyState canEdit={canCapturarFacturaProveedor} onCapturar={() => f.setOpenNueva(true)} />
          ) : (
            <TooltipProvider delayDuration={200}>
              <ResponsiveDataTable
                columns={columns}
                data={pageData}
                isLoading={isLoading}
                isError={isError}
                onRetry={() => refetch()}
                emptyMessage="No hay facturas que coincidan con los filtros"
                rowKey={(f) => f.id}
                density={TABLE_DENSITY.embebida}
                initialSort={{ key: "folio_interno", dir: "desc" }}
                onRowClick={abrirDetalle}
                stickyHeader
                columnVisibility={colVis.visibility}
                onColumnVisibilityChange={(updater) => {
                  const next = typeof updater === "function" ? updater(colVis.visibility) : updater;
                  colVis.setVisibility(next);
                }}
                pagination={{
                  page: pageActual,
                  totalPages,
                  onPageChange: f.setPage,
                  pageSize: f.pageSize,
                  total: data.length,
                }}
                mobileCard={(fact) => (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-semibold text-body truncate font-mono">{fact.folio_interno}</div>
                      <div className="text-body-sm text-muted-foreground truncate">{toTitleCase(fact.proveedor_nombre)}</div>
                      <div className="text-label text-muted-foreground">
                        Vence {fact.fecha_vencimiento ? formatDate(fact.fecha_vencimiento) : "—"}
                      </div>
                      <EstadoFacturaCxPCell factura={fact} />
                    </div>
                    <MoneyCell
                      label="Saldo"
                      value={formatCurrency(fact.saldo, fact.moneda)}
                      highlight
                      className="shrink-0 w-28"
                    />
                  </div>
                )}
              />
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      <CxpRouteDialogs
        f={f}
        data={data}
        isPendingEliminar={eliminar.isPending}
        onConfirmEliminar={async () => {
          if (!f.aEliminar) return;
          try { await eliminar.mutateAsync(f.aEliminar.id); } catch { /* hook notifica */ }
          f.setAEliminar(null);
        }}
      />
    </PageContainer>
  );
}
