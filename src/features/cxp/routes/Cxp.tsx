import { useCallback, useMemo } from "react";
import { Plus, FileText, Inbox, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnVisibilityMenu } from "@/components/shared/ColumnVisibilityMenu";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { EliminarFacturaCxpDialog } from "@/features/cxp/components/EliminarFacturaCxpDialog";
import { usePermissions, useColumnVisibility } from "@/hooks/shared";
import {
  useFacturasCxP,
  useEliminarFacturaProveedor,
  useCxpPageState,
  useCxpDeepLinks,
} from "@/features/cxp/hooks";
import { buildCxPColumns } from "@/features/cxp/components/cxpColumns";
import { DialogNuevaFacturaProveedor } from "@/features/cxp/components/DialogNuevaFacturaProveedor";
import { DialogEditarFacturaProveedor } from "@/features/cxp/components/DialogEditarFacturaProveedor";
import { DialogRegistrarPagoProveedor } from "@/features/cxp/components/DialogRegistrarPagoProveedor";
import { DialogDetallePagosProveedor } from "@/features/cxp/components/DialogDetallePagosProveedor";
import { CxpFiltros } from "@/features/cxp/components/CxpFiltros";
import { CxpKpiCards } from "@/features/cxp/components/CxpKpiCards";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CXP_COL_DEFAULTS, CXP_COL_OPTIONS } from "@/features/cxp/routes/_config/cxpColumnConfig";

import { useCobranza } from "@/features/facturacion/hooks";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { ReporteCarteraDocument } from "@/pdf/documents/ReporteCarteraDocument";
import type { FacturaCxP } from "@/features/cxp/services";
import { notifyError } from "@/lib/ui/appFeedback";
import { withOrgPrefix } from "@/lib/filenames";
import { todayLocalISO } from "@/lib/date/today";
import { formatCurrency } from "@/lib/formatters";

function exportarCxpCsv(rows: readonly FacturaCxP[]) {
  if (!rows || rows.length === 0) return;
  const headers = ["Folio", "Folio Prov", "Proveedor", "Emisión", "Vencimiento", "Moneda", "Total", "Pagado", "Saldo", "Estado"];
  const lines = rows.map((r) =>
    [
      r.folio_interno,
      `"${(r.folio_proveedor || "").replace(/"/g, '""')}"`,
      `"${(r.proveedor_nombre || "").replace(/"/g, '""')}"`,
      r.fecha_emision,
      r.fecha_vencimiento || "",
      r.moneda,
      formatCurrency(r.total, r.moneda),
      formatCurrency(r.pagado, r.moneda),
      formatCurrency(r.saldo, r.moneda),
      r.estatus,
    ].join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cxp-facturas-${todayLocalISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Cxp() {
  const { canEdit } = usePermissions();
  const f = useCxpPageState();

  const { data = [], isLoading, isError, refetch, kpis } = useFacturasCxP(f.queryArgs);
  const { data: cxc = [] } = useCobranza({});
  const eliminar = useEliminarFacturaProveedor();

  useCxpDeepLinks({ data, isLoading, onOpenDetalle: f.setDetalle, onSetAprobacion: f.setAprobacion });

  const handlePdf = async () => {
    const fecha = todayLocalISO();
    await descargarPdf(
      <ReporteCarteraDocument fechaCorte={fecha} cxc={cxc} cxp={data} />,
      await withOrgPrefix(`Reporte_Cartera_${fecha}.pdf`),
    );
  };

  const onEliminar = useCallback((fact: FacturaCxP) => {
    if (fact.pagado > 0) {
      notifyError(toast, { title: "No se puede eliminar: la factura tiene pagos registrados", method: "PAGES_CXP_CXP_1" });
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
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold">Aún no hay facturas de proveedor</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Captura la primera factura recibida para abrir su saldo en Cuentas por Pagar
                y empezar a registrar pagos.
              </p>
              {canEdit && (
                <Button className="mt-4" onClick={() => f.setOpenNueva(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Capturar primera factura
                </Button>
              )}
            </div>
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
                  onPageSizeChange: () => {},
                  pageSizeOptions: [f.pageSize],
                }}
              />
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      <DialogNuevaFacturaProveedor open={f.openNueva} onOpenChange={f.setOpenNueva} />
      <DialogEditarFacturaProveedor
        factura={f.editar ? data.find((d) => d.id === f.editar!.id) ?? f.editar : null}
        onOpenChange={(o) => !o && f.setEditar(null)}
      />
      <DialogRegistrarPagoProveedor
        open={!!f.pagar}
        onOpenChange={(o) => !o && f.setPagar(null)}
        factura={f.pagar ? data.find((d) => d.id === f.pagar!.id) ?? f.pagar : null}
      />
      <DialogDetallePagosProveedor
        open={!!f.detalle}
        onOpenChange={(o) => !o && f.setDetalle(null)}
        factura={f.detalle ? data.find((d) => d.id === f.detalle!.id) ?? f.detalle : null}
        canEdit={canEdit}
        onPagar={(fact) => { f.setDetalle(null); f.setPagar(fact); }}
        onEditar={(fact) => { f.setDetalle(null); f.setEditar(fact); }}
        onEliminar={(fact) => { f.setDetalle(null); onEliminar(fact); }}
      />

      <EliminarFacturaCxpDialog
        factura={f.aEliminar}
        onOpenChange={(o) => !o && f.setAEliminar(null)}
        isPending={eliminar.isPending}
        onConfirm={async () => {
          if (!f.aEliminar) return;
          try {
            await eliminar.mutateAsync(f.aEliminar.id);
          } catch {
            // Notificación gestionada por el hook.
          }
          f.setAEliminar(null);
        }}
      />
    </PageContainer>
  );
}
