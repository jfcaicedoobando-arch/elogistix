import { useMemo, useState } from "react";
import { Plus, FileText, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePermissions } from "@/hooks/shared";
import { useFacturasCxP, useEliminarFacturaProveedor } from "@/hooks/cxp";
import { buildCxPColumns } from "@/components/cxp/cxpColumns";
import { DialogNuevaFacturaProveedor } from "@/components/cxp/DialogNuevaFacturaProveedor";
import { DialogRegistrarPagoProveedor } from "@/components/cxp/DialogRegistrarPagoProveedor";
import { DialogDetallePagosProveedor } from "@/components/cxp/DialogDetallePagosProveedor";
import { CxpFiltros } from "@/components/cxp/CxpFiltros";
import { CxpKpiCards } from "@/components/cxp/CxpKpiCards";
import { useCobranza } from "@/hooks/facturacion";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { ReporteCarteraDocument } from "@/pdf/documents/ReporteCarteraDocument";
import type { FacturaCxP, EstatusCxP } from "@/services/cxp";

function useCxpFiltrosState() {
  const [search, setSearch] = useState("");
  const [estatus, setEstatus] = useState<EstatusCxP | "todos">("todos");
  const [moneda, setMoneda] = useState<"todas" | "MXN" | "USD" | "EUR">("todas");
  const [origen, setOrigen] = useState<"Nacional" | "Extranjero" | "todos">("todos");
  const [proveedorId, setProveedorId] = useState<string>("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const hayFiltros =
    search !== "" || estatus !== "todos" || moneda !== "todas" || origen !== "todos" ||
    proveedorId !== "todos" || fechaDesde !== "" || fechaHasta !== "";
  return {
    search, setSearch, estatus, setEstatus, moneda, setMoneda, origen, setOrigen,
    proveedorId, setProveedorId, fechaDesde, setFechaDesde, fechaHasta, setFechaHasta,
    hayFiltros,
  };
}

export default function Cxp() {
  const { canEdit } = usePermissions();
  const f = useCxpFiltrosState();

  const { data = [], isLoading, kpis } = useFacturasCxP({
    search: f.search || undefined,
    estatus: f.estatus,
    moneda: f.moneda,
    origen: f.origen,
    proveedor_id: f.proveedorId === "todos" ? undefined : f.proveedorId,
    fecha_desde: f.fechaDesde || undefined,
    fecha_hasta: f.fechaHasta || undefined,
  });
  const { data: cxc = [] } = useCobranza({});

  const handlePdf = async () => {
    await descargarPdf(
      <ReporteCarteraDocument
        fechaCorte={new Date().toISOString().slice(0, 10)}
        cxc={cxc} cxp={data}
      />,
      `Reporte_Cartera_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  const [openNueva, setOpenNueva] = useState(false);
  const [pagar, setPagar] = useState<FacturaCxP | null>(null);
  const [detalle, setDetalle] = useState<FacturaCxP | null>(null);
  const [aEliminar, setAEliminar] = useState<FacturaCxP | null>(null);

  const eliminar = useEliminarFacturaProveedor();

  const onEliminar = (f: FacturaCxP) => {
    if (f.pagado > 0) {
      toast.error("No se puede eliminar: la factura tiene pagos registrados");
      return;
    }
    setAEliminar(f);
  };

  const columns = useMemo(
    () => buildCxPColumns({
      canEdit, onRegistrarPago: setPagar, onVerDetalle: setDetalle, onEliminar,
    }),
    [canEdit],
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
              <Button onClick={() => setOpenNueva(true)}>
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
                <Button className="mt-4" onClick={() => setOpenNueva(true)}>
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
              onRowClick={(f) => setDetalle(f)}
            />
          )}
        </CardContent>
      </Card>

      <DialogNuevaFacturaProveedor open={openNueva} onOpenChange={setOpenNueva} />
      <DialogRegistrarPagoProveedor
        open={!!pagar}
        onOpenChange={(o) => !o && setPagar(null)}
        factura={pagar}
      />
      <DialogDetallePagosProveedor
        open={!!detalle}
        onOpenChange={(o) => !o && setDetalle(null)}
        factura={detalle}
        canEdit={canEdit}
      />
      <DoubleConfirmDeleteDialog
        open={!!aEliminar}
        onOpenChange={(o) => !o && setAEliminar(null)}
        entityName={aEliminar ? `la factura ${aEliminar.folio_proveedor}` : "la factura"}
        description={aEliminar
          ? `La factura ${aEliminar.folio_proveedor} de ${aEliminar.proveedor_nombre} será enviada a la papelera.`
          : undefined}
        finalDescription="Puedes restaurarla desde la papelera si fue un error."
        isPending={eliminar.isPending}
        onConfirm={async () => {
          if (!aEliminar) return;
          await eliminar.mutateAsync(aEliminar.id, {
            onSuccess: () => toast.success("Factura eliminada"),
            onError: (e) => toast.error((e as Error).message),
          });
          setAEliminar(null);
        }}
      />
    </div>
  );
}
