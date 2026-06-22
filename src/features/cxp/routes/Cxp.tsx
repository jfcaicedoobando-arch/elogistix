import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, FileText, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePermissions } from "@/hooks/shared";
import { useFacturasCxP, useEliminarFacturaProveedor, useCxpPageState } from "@/features/cxp/hooks";
import { buildCxPColumns } from "@/features/cxp/components/cxpColumns";
import { DialogNuevaFacturaProveedor } from "@/features/cxp/components/DialogNuevaFacturaProveedor";
import { DialogRegistrarPagoProveedor } from "@/features/cxp/components/DialogRegistrarPagoProveedor";
import { DialogDetallePagosProveedor } from "@/features/cxp/components/DialogDetallePagosProveedor";
import { CxpFiltros } from "@/features/cxp/components/CxpFiltros";
import { CxpKpiCards } from "@/features/cxp/components/CxpKpiCards";
import { ComprasTabStrip } from "@/features/cxp/components/ComprasTabStrip";
import { useCobranza } from "@/features/facturacion/hooks";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { ReporteCarteraDocument } from "@/pdf/documents/ReporteCarteraDocument";
import type { FacturaCxP } from "@/features/cxp/services";
import { notifyError } from "@/components/shared/utils/appFeedback";



export default function Cxp() {
  const { canEdit } = usePermissions();
  const f = useCxpPageState();

  const { data = [], isLoading, kpis } = useFacturasCxP(f.queryArgs);
  const { data: cxc = [] } = useCobranza({});
  const eliminar = useEliminarFacturaProveedor();

  const handlePdf = async () => {
    await descargarPdf(
      <ReporteCarteraDocument
        fechaCorte={new Date().toISOString().slice(0, 10)}
        cxc={cxc} cxp={data}
      />,
      `Reporte_Cartera_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  const onEliminar = useCallback((fact: FacturaCxP) => {
    if (fact.pagado > 0) {
      notifyError(toast, { title: "No se puede eliminar: la factura tiene pagos registrados", method: "PAGES_CXP_CXP_1" });
      return;
    }
    f.setAEliminar(fact);
  }, [f]);

  const columns = useMemo(
    () => buildCxPColumns({
      canEdit,
      onRegistrarPago: f.setPagar,
      onVerDetalle: f.setDetalle,
      onEliminar,
    }),
    [canEdit, f.setPagar, f.setDetalle, onEliminar],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cuentas por Pagar"
        description="Facturas recibidas de proveedores y su saldo pendiente"
        actions={
          <div className="flex gap-2">
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
        <CardContent className="p-4">
          <CxpFiltros
            search={f.search} onSearchChange={f.setSearch}
            estatus={f.estatus} onEstatusChange={f.setEstatus}
            moneda={f.moneda} onMonedaChange={f.setMoneda}
            origen={f.origen} onOrigenChange={f.setOrigen}
            proveedorId={f.proveedorId} onProveedorChange={f.setProveedorId}
            fechaDesde={f.fechaDesde} onFechaDesdeChange={f.setFechaDesde}
            fechaHasta={f.fechaHasta} onFechaHastaChange={f.setFechaHasta}
          />
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
            <DataTable
              columns={columns}
              data={data}
              isLoading={isLoading}
              emptyMessage="No hay facturas que coincidan con los filtros"
              rowKey={(f) => f.id}
              density="compact"
              onRowClick={(fact) => f.setDetalle(fact)}
            />
          )}
        </CardContent>
      </Card>

      <DialogNuevaFacturaProveedor open={f.openNueva} onOpenChange={f.setOpenNueva} />
      <DialogRegistrarPagoProveedor
        open={!!f.pagar}
        onOpenChange={(o) => !o && f.setPagar(null)}
        factura={f.pagar}
      />
      <DialogDetallePagosProveedor
        open={!!f.detalle}
        onOpenChange={(o) => !o && f.setDetalle(null)}
        factura={f.detalle}
        canEdit={canEdit}
      />
      <DoubleConfirmDeleteDialog
        open={!!f.aEliminar}
        onOpenChange={(o) => !o && f.setAEliminar(null)}
        entityName={f.aEliminar ? `la factura ${f.aEliminar.folio_proveedor}` : "la factura"}
        description={f.aEliminar
          ? `La factura ${f.aEliminar.folio_proveedor} de ${f.aEliminar.proveedor_nombre} será enviada a la papelera.`
          : undefined}
        finalDescription="Puedes restaurarla desde la papelera si fue un error."
        isPending={eliminar.isPending}
        onConfirm={async () => {
          if (!f.aEliminar) return;
          // 13.85.10 — Toasts viven en `useEliminarFacturaProveedor`. No duplicar aquí.
          try {
            await eliminar.mutateAsync(f.aEliminar.id);
          } catch {
            // Notificación gestionada por el hook.
          }
          f.setAEliminar(null);
        }}
      />
    </div>
  );
}
